/**
 * ============================================================================
 * 快闪群聊App - WebSocket状态管理
 * ============================================================================
 */

import { create } from 'zustand';
import { wsClient } from '../api/websocket';
import {
  Message,
  Danmaku,
  HeatUpdateEvent,
  ForceLeaveEvent,
  MessageRemovedEvent,
  Group,
} from '../types';

interface WebSocketState {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;

  // 首页数据
  homeGroups: Group[];
  danmakuList: Danmaku[];

  // 群聊数据
  currentGroup: Group | null;
  currentGroupId: string | null;  // 当前群ID
  messages: Message[];

  // Actions
  connect: () => void;
  disconnect: () => void;
  joinHome: (userId: string) => void;
  leaveHome: () => void;
  joinGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => void;
  sendMessage: (groupId: string, content: string) => void;
  sendDanmaku: (content: string) => void;
  deleteMessage: (msgId: string, groupId: string) => void;

  // 数据更新
  setHomeGroups: (groups: Group[]) => void;
  addDanmaku: (danmaku: Danmaku) => void;
  addMessage: (message: Message) => void;
  removeMessage: (msgId: string) => void;
  updateHeat: (event: HeatUpdateEvent) => void;
  setCurrentGroup: (group: Group | null) => void;
  clearMessages: () => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  connected: false,
  reconnecting: false,
  reconnectAttempts: 0,
  homeGroups: [],
  danmakuList: [],
  currentGroup: null,
  currentGroupId: null,
  messages: [],

  connect: () => {
    wsClient.connect();

    // 监听连接事件
    wsClient.on('connected', () => {
      console.log('WebSocketStore: connected');
      set({ connected: true, reconnecting: false });
    });

    wsClient.on('disconnected', () => {
      console.log('WebSocketStore: disconnected');
      set({ connected: false });
    });

    wsClient.on('reconnecting', ({ attemptNumber }) => {
      console.log('WebSocketStore: reconnecting', attemptNumber);
      set({ reconnecting: true, reconnectAttempts: attemptNumber });
    });

    wsClient.on('reconnected', () => {
      console.log('WebSocketStore: reconnected');
      set({ connected: true, reconnecting: false, reconnectAttempts: 0 });
    });

    // 监听数据事件
    wsClient.on('home_init', ({ groups, danmakuHistory }) => {
      console.log('WebSocketStore: home_init received', groups.length, 'groups');
      set({ homeGroups: groups, danmakuList: danmakuHistory });
    });

    wsClient.on('group_init', (data) => {
      console.log('WebSocketStore: group_init received', data);
      set({ 
        currentGroup: data.group, 
        currentGroupId: data.group?.id || null,
        messages: data.messages || [] 
      });
    });

    wsClient.on('group_message', (message: Message) => {
      console.log('WebSocketStore: group_message received', message);
      // 只添加属于当前群的消息
      const currentGroupId = get().currentGroupId;
      if (message.groupId === currentGroupId) {
        get().addMessage(message);
      }
    });

    wsClient.on('heat_update', (event: HeatUpdateEvent) => {
      console.log('WebSocketStore: heat_update received', event);
      get().updateHeat(event);
    });

    wsClient.on('danmaku', (danmaku: Danmaku) => {
      console.log('WebSocketStore: danmaku received', danmaku);
      get().addDanmaku(danmaku);
    });

    wsClient.on('force_leave', (event: ForceLeaveEvent) => {
      console.log('WebSocketStore: force_leave received', event);
      if (event.reason === 'group_dissolved') {
        set({ currentGroup: null, currentGroupId: null, messages: [] });
      }
    });

    wsClient.on('message_removed', (event: MessageRemovedEvent) => {
      console.log('WebSocketStore: message_removed received', event);
      get().removeMessage(event.msgId);
    });
  },

  disconnect: () => {
    wsClient.disconnect();
    set({ connected: false });
  },

  joinHome: (userId: string) => {
    console.log('WebSocketStore: joinHome', userId);
    wsClient.joinHome(userId);
  },

  leaveHome: () => {
    console.log('WebSocketStore: leaveHome');
    wsClient.leaveHome();
  },

  joinGroup: (groupId: string) => {
    console.log('WebSocketStore: joinGroup', groupId);
    // 获取token
    const authData = localStorage.getItem('flashchat-auth');
    let token = null;
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        token = parsed?.state?.token;
      } catch {
        // ignore
      }
    }
    set({ currentGroupId: groupId, messages: [] });
    wsClient.joinGroup(groupId, token);
  },

  leaveGroup: (groupId: string) => {
    console.log('WebSocketStore: leaveGroup', groupId);
    wsClient.leaveGroup(groupId);
    set({ currentGroupId: null, messages: [] });
  },

  sendMessage: (groupId: string, content: string) => {
    console.log('WebSocketStore: sendMessage', groupId, content);
    wsClient.sendMessage(groupId, content);
  },

  sendDanmaku: (content: string) => {
    console.log('WebSocketStore: sendDanmaku', content);
    wsClient.sendDanmaku(content);
  },

  deleteMessage: (msgId: string, groupId: string) => {
    console.log('WebSocketStore: deleteMessage', msgId, groupId);
    wsClient.deleteMessage(msgId, groupId);
  },

  setHomeGroups: (groups) => set({ homeGroups: groups }),

  addDanmaku: (danmaku) => {
    set((state) => ({
      danmakuList: [...state.danmakuList.slice(-50), danmaku],
    }));
  },

  addMessage: (message) => {
    console.log('WebSocketStore: addMessage', message);
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  removeMessage: (msgId) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== msgId),
    }));
  },

  updateHeat: (event) => {
    set((state) => ({
      homeGroups: state.homeGroups.map((g) =>
        g.id === event.groupId
          ? { ...g, heatLevel: event.level, heatColor: event.color }
          : g
      ),
    }));
  },

  setCurrentGroup: (group) => set({ currentGroup: group }),

  clearMessages: () => set({ messages: [] }),
}));
