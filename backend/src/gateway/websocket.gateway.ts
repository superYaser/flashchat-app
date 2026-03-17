/**
 * ============================================================================
 * 快闪群聊App - WebSocket 网关
 * ============================================================================
 * 负责处理所有WebSocket连接和事件分发
 * 实现房间管理、消息广播、心跳检测等功能
 * ============================================================================
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  UserId,
  GroupId,
  ClientEvent,
  ServerEvent,
  JoinHomeRequest,
  SendMessageRequest,
  SendDanmakuRequest,
  HeatUpdateEvent,
  ForceLeaveEvent,
  MessageRemovedEvent,
  WebSocketPayload,
  ErrorCode,
  Danmaku,
  Message,
} from '../../../shared/types';
import { config } from '../config';
import { logger } from '../utils/logger';
import { RedisClient } from '../utils/redis';
import { MessageService } from '../services/message/message.service';
import { GroupService } from '../services/group/group.service';
import { DanmakuService } from '../services/danmaku/danmaku.service';
import { authMiddleware } from '../middleware/auth';

/**
 * 连接元数据
 */
interface ConnectionMeta {
  userId: UserId;
  connectedAt: number;
  rooms: Set<string>;
}

/**
 * WebSocket 网关类
 * 管理所有客户端连接和消息路由
 */
export class WebSocketGateway {
  private io: SocketIOServer;
  private connections: Map<string, ConnectionMeta> = new Map();
  private messageService: MessageService;
  private groupService: GroupService;
  private danmakuService: DanmakuService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.messageService = new MessageService();
    this.groupService = new GroupService();
    this.danmakuService = new DanmakuService();
  }

  /**
   * 初始化WebSocket网关
   */
  public initialize(): void {
    // 认证中间件
    this.io.use(authMiddleware);

    // 连接处理
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    logger.info('WebSocket gateway initialized');
  }

  /**
   * 处理新连接
   */
  private handleConnection(socket: Socket): void {
    const userId = socket.data.userId as UserId;
    
    // 检查连接数限制
    if (this.getUserConnectionCount(userId) >= config.websocket.maxConnectionsPerUser) {
      socket.emit('error', {
        code: ErrorCode.WS_CONNECTION_LIMIT,
        message: 'Maximum connections exceeded',
      });
      socket.disconnect();
      return;
    }

    // 记录连接
    this.connections.set(socket.id, {
      userId,
      connectedAt: Date.now(),
      rooms: new Set(),
    });

    logger.info(`User ${userId} connected, socket: ${socket.id}`);

    // 注册事件处理器
    this.registerEventHandlers(socket);

    // 断开连接处理
    socket.on('disconnect', (reason) => {
      this.handleDisconnect(socket, reason);
    });
  }

  /**
   * 注册事件处理器
   */
  private registerEventHandlers(socket: Socket): void {
    // 加入首页
    socket.on('join_home', async (data: JoinHomeRequest) => {
      await this.handleJoinHome(socket, data);
    });

    // 离开首页
    socket.on('leave_home', async () => {
      await this.handleLeaveHome(socket);
    });

    // 加入群组
    socket.on('join_group', async (data: { groupId: GroupId }) => {
      await this.handleJoinGroup(socket, data.groupId);
    });

    // 离开群组
    socket.on('leave_group', async (data: { groupId: GroupId }) => {
      await this.handleLeaveGroup(socket, data.groupId);
    });

    // 发送消息
    socket.on('send_message', async (data: SendMessageRequest) => {
      await this.handleSendMessage(socket, data);
    });

    // 发送弹幕
    socket.on('send_danmaku', async (data: SendDanmakuRequest) => {
      await this.handleSendDanmaku(socket, data);
    });

    // 删除消息
    socket.on('delete_message', async (data: { msgId: string; groupId: GroupId }) => {
      await this.handleDeleteMessage(socket, data);
    });

    // 心跳
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  }

  /**
   * 处理加入首页
   */
  private async handleJoinHome(socket: Socket, data: JoinHomeRequest): Promise<void> {
    try {
      // 加入首页房间
      socket.join('home');
      this.connections.get(socket.id)?.rooms.add('home');

      // 获取首页数据
      const groups = await this.groupService.getHomeGroups();
      const danmakuHistory = await this.danmakuService.getRecentDanmaku();

      // 发送首页初始化数据
      socket.emit('home_init', {
        groups,
        danmakuHistory,
      });

      logger.debug(`User ${data.userId} joined home`);
    } catch (error) {
      logger.error('Error in join_home:', error);
      socket.emit('error', {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Failed to join home',
      });
    }
  }

  /**
   * 处理离开首页
   */
  private async handleLeaveHome(socket: Socket): Promise<void> {
    socket.leave('home');
    this.connections.get(socket.id)?.rooms.delete('home');
    logger.debug(`User left home`);
  }

  /**
   * 处理加入群组
   */
  private async handleJoinGroup(socket: Socket, groupId: GroupId): Promise<void> {
    try {
      const userId = socket.data.userId as UserId;
      
      // 检查群组是否存在且未满
      const group = await this.groupService.getGroupById(groupId);
      if (!group) {
        socket.emit('error', {
          code: ErrorCode.GROUP_NOT_FOUND,
          message: 'Group not found',
        });
        return;
      }

      if (group.memberCount >= config.business.maxGroupMembers) {
        socket.emit('error', {
          code: ErrorCode.GROUP_FULL,
          message: 'Group is full',
        });
        return;
      }

      // 加入群组房间
      const roomName = `group:${groupId}`;
      socket.join(roomName);
      this.connections.get(socket.id)?.rooms.add(roomName);

      // 添加成员
      await this.groupService.addMember(groupId, userId);

      // 获取最近消息
      const messages = await this.messageService.getGroupMessages(groupId);

      // 发送群组初始化数据
      socket.emit('group_init', {
        group,
        messages,
      });

      // 广播成员加入事件
      socket.to(roomName).emit('member_joined', {
        userId,
        memberCount: group.memberCount + 1,
      });

      logger.debug(`User ${userId} joined group ${groupId}`);
    } catch (error) {
      logger.error('Error in join_group:', error);
      socket.emit('error', {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Failed to join group',
      });
    }
  }

  /**
   * 处理离开群组
   */
  private async handleLeaveGroup(socket: Socket, groupId: GroupId): Promise<void> {
    try {
      const userId = socket.data.userId as UserId;
      const roomName = `group:${groupId}`;

      socket.leave(roomName);
      this.connections.get(socket.id)?.rooms.delete(roomName);

      // 移除成员
      await this.groupService.removeMember(groupId, userId);

      // 广播成员离开事件
      const group = await this.groupService.getGroupById(groupId);
      socket.to(roomName).emit('member_left', {
        userId,
        memberCount: group?.memberCount || 0,
      });

      logger.debug(`User ${userId} left group ${groupId}`);
    } catch (error) {
      logger.error('Error in leave_group:', error);
    }
  }

  /**
   * 处理发送消息
   */
  private async handleSendMessage(socket: Socket, data: SendMessageRequest): Promise<void> {
    try {
      const userId = socket.data.userId as UserId;
      const { groupId, content, type } = data;

      // 创建消息
      const message = await this.messageService.createMessage({
        groupId,
        senderId: userId,
        content,
        type,
      });

      if (!message) {
        socket.emit('error', {
          code: ErrorCode.MESSAGE_CONTAINS_SENSITIVE_WORDS,
          message: 'Message contains sensitive words',
        });
        return;
      }

      // 广播消息到群组
      const roomName = `group:${groupId}`;
      this.io.to(roomName).emit('group_message', {
        ...message,
        isSelf: false,
      });

      // 发送者标记为isSelf
      socket.emit('group_message', {
        ...message,
        isSelf: true,
      });

      // 更新热度计数
      await this.groupService.incrementHeatCount(groupId);

      logger.debug(`Message sent to group ${groupId} by ${userId}`);
    } catch (error) {
      logger.error('Error in send_message:', error);
      socket.emit('error', {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Failed to send message',
      });
    }
  }

  /**
   * 处理发送弹幕
   */
  private async handleSendDanmaku(socket: Socket, data: SendDanmakuRequest): Promise<void> {
    try {
      const userId = socket.data.userId as UserId;
      const { content } = data;

      // 创建弹幕
      const danmaku = await this.danmakuService.createDanmaku({
        senderId: userId,
        content,
      });

      // 广播弹幕到首页（仅首页用户可见）
      this.io.to('home').emit('danmaku', danmaku);

      logger.debug(`Danmaku sent by ${userId}`);
    } catch (error) {
      logger.error('Error in send_danmaku:', error);
      socket.emit('error', {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Failed to send danmaku',
      });
    }
  }

  /**
   * 处理删除消息
   */
  private async handleDeleteMessage(
    socket: Socket,
    data: { msgId: string; groupId: GroupId }
  ): Promise<void> {
    try {
      const userId = socket.data.userId as UserId;
      const { msgId, groupId } = data;

      // 验证群主权限
      const isOwner = await this.groupService.isGroupOwner(groupId, userId);
      if (!isOwner) {
        socket.emit('error', {
          code: ErrorCode.NOT_GROUP_OWNER,
          message: 'Only group owner can delete messages',
        });
        return;
      }

      // 删除消息
      await this.messageService.deleteMessage(msgId);

      // 广播消息移除事件（静默删除，无提示）
      const roomName = `group:${groupId}`;
      this.io.to(roomName).emit('message_removed', {
        msgId,
        silent: true,
      } as MessageRemovedEvent);

      logger.debug(`Message ${msgId} deleted by owner ${userId}`);
    } catch (error) {
      logger.error('Error in delete_message:', error);
      socket.emit('error', {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Failed to delete message',
      });
    }
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(socket: Socket, reason: string): void {
    const meta = this.connections.get(socket.id);
    if (meta) {
      logger.info(`User ${meta.userId} disconnected, reason: ${reason}`);
      this.connections.delete(socket.id);
    }
  }

  /**
   * 获取用户连接数
   */
  private getUserConnectionCount(userId: UserId): number {
    let count = 0;
    for (const meta of this.connections.values()) {
      if (meta.userId === userId) {
        count++;
      }
    }
    return count;
  }

  // ========================================================================
  // 公共广播方法（供其他服务调用）
  // ========================================================================

  /**
   * 广播热度更新
   */
  public broadcastHeatUpdate(data: HeatUpdateEvent): void {
    this.io.to('home').emit('heat_update', data);
  }

  /**
   * 强制用户离开群组（解散群时调用）
   */
  public async forceLeaveGroup(groupId: GroupId): Promise<void> {
    const roomName = `group:${groupId}`;
    const sockets = await this.io.in(roomName).fetchSockets();

    for (const socket of sockets) {
      // 发送强制离开事件
      socket.emit('force_leave', {
        groupId,
        reason: 'group_dissolved',
        redirectTo: 'home',
        silent: true,
      } as ForceLeaveEvent);

      // 离开房间
      socket.leave(roomName);
      this.connections.get(socket.id)?.rooms.delete(roomName);
    }
  }

  /**
   * 获取在线连接数
   */
  public getConnectionCount(): number {
    return this.connections.size;
  }
}
