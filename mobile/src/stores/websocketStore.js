import { create } from 'zustand';
import { wsClient } from '../api/websocket';

export const useWebSocketStore = create((set, get) => ({
  // 状态
  connected: false,
  reconnecting: false,
  reconnectAttempts: 0,

  // 首页数据
  homeGroups: [],
  danmakuList: [],

  // 群聊数据
  currentGroup: null,
  currentGroupId: null,
  messages: [],

  // 连接WebSocket
  connect: () => {
    wsClient.connect();

    wsClient.on('connected', () => {
      set({ connected: true, reconnecting: false });
    });

    wsClient.on('disconnected', () => {
      set({ connected: false });
    });

    wsClient.on('reconnecting', ({ attemptNumber }) => {
      set({ reconnecting: true, reconnectAttempts: attemptNumber });
    });

    wsClient.on('reconnected', () => {
      set({ connected: true, reconnecting: false, reconnectAttempts: 0 });
    });

    wsClient.on('home_init', ({ groups, danmakuHistory }) => {
      set({ homeGroups: groups, danmakuList: danmakuHistory });
    });

    wsClient.on('group_init', (data) => {
      set({ 
        currentGroup: data.group, 
        currentGroupId: data.group?.id || null,
        messages: data.messages || [] 
      });
    });

    wsClient.on('group_message', (message) => {
      // 只添加属于当前群的消息
      const currentGroupId = get().currentGroupId;
      if (message.groupId === currentGroupId) {
        set((state) => ({ messages: [...state.messages, message] }));
      }
    });

    wsClient.on('danmaku', (danmaku) => {
      set((state) => ({ 
        danmakuList: [...state.danmakuList.slice(-20), danmaku] 
      }));
    });

    wsClient.on('force_leave', (event) => {
      if (event.reason === 'group_dissolved') {
        set({ currentGroup: null, currentGroupId: null, messages: [] });
      }
    });

    wsClient.on('message_removed', (event) => {
      set((state) => ({ 
        messages: state.messages.filter((m) => m.id !== event.msgId) 
      }));
    });
  },

  // 断开连接
  disconnect: () => {
    wsClient.disconnect();
    set({ connected: false });
  },

  // 加入首页
  joinHome: (userId) => {
    wsClient.joinHome(userId);
  },

  // 离开首页
  leaveHome: () => {
    wsClient.leaveHome();
  },

  // 加入群组
  joinGroup: (groupId) => {
    set({ currentGroupId: groupId, messages: [] });
    wsClient.joinGroup(groupId);
  },

  // 离开群组
  leaveGroup: (groupId) => {
    wsClient.leaveGroup(groupId);
    set({ currentGroupId: null, messages: [] });
  },

  // 发送消息
  sendMessage: (groupId, content) => {
    wsClient.sendMessage(groupId, content);
  },

  // 发送弹幕
  sendDanmaku: (content) => {
    wsClient.sendDanmaku(content);
  },

  // 删除消息
  deleteMessage: (msgId, groupId) => {
    wsClient.deleteMessage(msgId, groupId);
  },
}));
