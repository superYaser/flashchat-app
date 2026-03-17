/**
 * ============================================================================
 * 快闪群聊App - WebSocket 客户端
 * ============================================================================
 * 封装Socket.IO客户端，提供WebSocket连接管理
 * ============================================================================
 */

import { io, Socket } from 'socket.io-client';
import {
  ClientEvent,
  ServerEvent,
  JoinHomeRequest,
  SendMessageRequest,
  SendDanmakuRequest,
  HeatUpdateEvent,
  ForceLeaveEvent,
  MessageRemovedEvent,
  Message,
  Danmaku,
  Group,
} from '../types';

/**
 * WebSocket配置 - Vite使用import.meta.env
 */
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

/**
 * 事件处理器类型
 */
type EventHandler<T = any> = (data: T) => void;

/**
 * WebSocket客户端类
 */
export class WebSocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private eventHandlers: Map<string, EventHandler[]> = new Map();

  /**
   * 设置认证令牌
   */
  public setToken(token: string): void {
    this.token = token;
  }

  /**
   * 连接WebSocket
   */
  public connect(): void {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Connecting to WebSocket:', WS_URL);

    this.socket = io(WS_URL, {
      auth: {
        token: this.token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: this.maxReconnectDelay,
    });

    this.setupEventListeners();
  }

  /**
   * 断开连接
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // 连接成功
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected', null);
    });

    // 连接断开
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.emit('disconnected', { reason });
    });

    // 连接错误
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.emit('error', { error: error.message });
    });

    // 重连中
    this.socket.on('reconnecting', (attemptNumber) => {
      console.log('WebSocket reconnecting, attempt:', attemptNumber);
      this.reconnectAttempts = attemptNumber;
      this.emit('reconnecting', { attemptNumber });
    });

    // 重连成功
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
      this.emit('reconnected', { attemptNumber });
    });

    // 重连失败
    this.socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnect failed');
      this.emit('reconnect_failed', null);
    });

    // 首页初始化数据
    this.socket.on('home_init', (data: { groups: Group[]; danmakuHistory: Danmaku[] }) => {
      console.log('Home init data received:', data);
      this.emit('home_init', data);
    });

    // 群组消息
    this.socket.on('group_message', (data: Message & { isSelf: boolean }) => {
      console.log('Group message received:', data);
      this.emit('group_message', data);
    });

    // 热度更新
    this.socket.on('heat_update', (data: HeatUpdateEvent) => {
      this.emit('heat_update', data);
    });

    // 弹幕
    this.socket.on('danmaku', (data: Danmaku) => {
      console.log('Danmaku received:', data);
      this.emit('danmaku', data);
    });

    // 强制离开
    this.socket.on('force_leave', (data: ForceLeaveEvent) => {
      console.log('Force leave received:', data);
      this.emit('force_leave', data);
    });

    // 消息移除
    this.socket.on('message_removed', (data: MessageRemovedEvent) => {
      this.emit('message_removed', data);
    });

    // 错误
    this.socket.on('error', (data: { code: number; message: string }) => {
      console.error('WebSocket error:', data);
      this.emit('error', data);
    });
  }

  /**
   * 发送事件
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  /**
   * 订阅事件
   */
  public on<T = any>(event: string, handler: EventHandler<T>): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * 取消订阅
   */
  public off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // ========================================================================
  // 客户端事件发送
  // ========================================================================

  /**
   * 加入首页
   */
  public joinHome(userId: string): void {
    console.log('Emitting join_home:', userId);
    this.socket?.emit('join_home', { userId } as JoinHomeRequest);
  }

  /**
   * 离开首页
   */
  public leaveHome(): void {
    this.socket?.emit('leave_home');
  }

  /**
   * 加入群组
   */
  public joinGroup(groupId: string, token?: string): void {
    console.log('Emitting join_group:', groupId);
    this.socket?.emit('join_group', { groupId, token });
  }

  /**
   * 离开群组
   */
  public leaveGroup(groupId: string): void {
    this.socket?.emit('leave_group', { groupId });
  }

  /**
   * 发送消息
   */
  public sendMessage(groupId: string, content: string, type: 'text' | 'system' = 'text'): void {
    console.log('Emitting send_message:', { groupId, content });
    this.socket?.emit('send_message', {
      groupId,
      content,
      type,
    } as SendMessageRequest);
  }

  /**
   * 发送弹幕
   */
  public sendDanmaku(content: string): void {
    console.log('Emitting send_danmaku:', content);
    this.socket?.emit('send_danmaku', { content } as SendDanmakuRequest);
  }

  /**
   * 删除消息
   */
  public deleteMessage(msgId: string, groupId: string): void {
    this.socket?.emit('delete_message', { msgId, groupId });
  }

  // ========================================================================
  // 状态查询
  // ========================================================================

  /**
   * 是否已连接
   */
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * 获取重连尝试次数
   */
  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

/**
 * 创建WebSocket客户端实例
 */
export const wsClient = new WebSocketClient();
