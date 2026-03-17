import io from 'socket.io-client';
import { WS_URL } from '../constants/config';
import { storage, STORAGE_KEYS } from '../utils/storage';

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.eventHandlers = new Map();
  }

  // 连接WebSocket
  async connect() {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Connecting to WebSocket:', WS_URL);

    // 获取token
    const token = await storage.getItem(STORAGE_KEYS.TOKEN);

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // 设置事件监听器
  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.emit('connected', null);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.emit('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.emit('error', { error: error.message });
    });

    this.socket.on('home_init', (data) => {
      console.log('Home init received:', data);
      this.emit('home_init', data);
    });

    this.socket.on('group_init', (data) => {
      console.log('Group init received:', data);
      this.emit('group_init', data);
    });

    this.socket.on('group_message', (data) => {
      console.log('Group message received:', data);
      this.emit('group_message', data);
    });

    this.socket.on('danmaku', (data) => {
      console.log('Danmaku received:', data);
      this.emit('danmaku', data);
    });

    this.socket.on('force_leave', (data) => {
      console.log('Force leave received:', data);
      this.emit('force_leave', data);
    });

    this.socket.on('message_removed', (data) => {
      this.emit('message_removed', data);
    });

    this.socket.on('error', (data) => {
      console.error('WebSocket error:', data);
      this.emit('error', data);
    });
  }

  // 发送事件
  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  // 订阅事件
  on(event, handler) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  // 取消订阅
  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // 加入首页
  joinHome(userId) {
    this.socket?.emit('join_home', { userId });
  }

  // 离开首页
  leaveHome() {
    this.socket?.emit('leave_home');
  }

  // 加入群组
  joinGroup(groupId, token) {
    this.socket?.emit('join_group', { groupId, token });
  }

  // 离开群组
  leaveGroup(groupId) {
    this.socket?.emit('leave_group', { groupId });
  }

  // 发送消息
  sendMessage(groupId, content, type = 'text') {
    this.socket?.emit('send_message', { groupId, content, type });
  }

  // 发送弹幕
  sendDanmaku(content) {
    this.socket?.emit('send_danmaku', { content });
  }

  // 删除消息
  deleteMessage(msgId, groupId) {
    this.socket?.emit('delete_message', { msgId, groupId });
  }

  // 是否已连接
  isConnected() {
    return this.socket?.connected || false;
  }
}

export const wsClient = new WebSocketClient();
