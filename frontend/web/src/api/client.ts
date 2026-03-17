/**
 * ============================================================================
 * 快闪群聊App - API 客户端
 * ============================================================================
 * 封装HTTP请求，提供统一的API调用接口
 * ============================================================================
 */

import {
  ApiResponse,
  User,
  Group,
  Message,
  CreateGroupRequest,
  CreateGroupResponse,
  GetMessagesResponse,
  DissolveCooldown,
  ErrorCode,
} from '../types';

/**
 * API配置 - Vite使用import.meta.env
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

/**
 * 获取认证令牌
 */
function getToken(): string | null {
  if (typeof window !== 'undefined') {
    // 从localStorage获取token (zustand persist会存储到这里)
    const authData = localStorage.getItem('flashchat-auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        return parsed?.state?.token || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * 通用请求函数
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log('API Request:', url, options.method || 'GET');

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data: ApiResponse<T> = await response.json();
  console.log('API Response:', url, data.code);

  return data;
}

/**
 * 用户相关API
 */
export const userAPI = {
  /**
   * 用户注册 - 使用name和password
   */
  register: (name: string, password: string) =>
    request<{ user: User; token: string }>('/users/register', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    }),

  /**
   * 用户登录 - 使用name和password
   */
  login: (name: string, password: string) =>
    request<{ user: User; token: string }>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    }),

  /**
   * 获取当前用户信息
   */
  getCurrentUser: () => request<User>('/users/me'),

  /**
   * 更新用户信息
   */
  updateProfile: (data: Partial<User>) =>
    request<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

/**
 * 群组相关API
 */
export const groupAPI = {
  /**
   * 获取首页群组列表
   */
  getHomeGroups: () => request<Group[]>('/groups'),

  /**
   * 获取群组详情
   */
  getGroupById: (groupId: string) => request<Group>(`/groups/${groupId}`),

  /**
   * 创建群组
   */
  createGroup: (data: CreateGroupRequest) =>
    request<CreateGroupResponse>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * 解散群组
   */
  dissolveGroup: (groupId: string) =>
    request<null>(`/groups/${groupId}`, {
      method: 'DELETE',
    }),

  /**
   * 获取群成员列表
   */
  getGroupMembers: (groupId: string) => request<string[]>(`/groups/${groupId}/members`),

  /**
   * 获取解散冷却状态
   */
  getCooldownStatus: () => request<DissolveCooldown | null>('/groups/my/cooldown'),

  /**
   * 获取用户创建的群
   */
  getMyGroup: () => request<Group | null>('/groups/my/owned'),
};

/**
 * 消息相关API
 */
export const messageAPI = {
  /**
   * 获取群组消息列表
   */
  getGroupMessages: (groupId: string) =>
    request<GetMessagesResponse>(`/groups/${groupId}/messages`),

  /**
   * 发送消息（REST备用接口）
   */
  sendMessage: (groupId: string, content: string, type: 'text' | 'system' = 'text') =>
    request<Message>(`/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type }),
    }),

  /**
   * 删除消息
   */
  deleteMessage: (groupId: string, msgId: string) =>
    request<null>(`/groups/${groupId}/messages/${msgId}`, {
      method: 'DELETE',
    }),

  /**
   * 校验消息长度
   */
  validateMessage: (content: string) =>
    request<{
      valid: boolean;
      length: number;
      maxLength: number;
      displayMode: 'full' | 'summary';
      summary?: string;
      fullContent?: string;
      error?: string;
    }>('/messages/validate', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

/**
 * 弹幕相关API
 */
export const danmakuAPI = {
  /**
   * 获取最近弹幕
   */
  getRecentDanmaku: () => request<any[]>('/danmaku'),

  /**
   * 发送弹幕（REST备用接口）
   */
  sendDanmaku: (content: string) =>
    request<any>('/danmaku', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

export { request };
