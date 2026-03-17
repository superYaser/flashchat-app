import { API_BASE_URL } from '../constants/config';
import { storage, STORAGE_KEYS } from '../utils/storage';

// 通用请求函数
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // 添加认证token
  const token = await storage.getItem(STORAGE_KEYS.TOKEN);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log('API Request:', url, options.method || 'GET');

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();
  console.log('API Response:', url, data.code);

  return data;
}

// 用户相关API
export const userAPI = {
  // 注册
  register: (name, password) =>
    request('/users/register', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    }),

  // 登录
  login: (name, password) =>
    request('/users/login', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    }),

  // 获取当前用户
  getCurrentUser: () => request('/users/me'),
};

// 群组相关API
export const groupAPI = {
  // 获取群组列表
  getGroups: () => request('/groups'),

  // 获取群组详情
  getGroupById: (groupId) => request(`/groups/${groupId}`),

  // 创建群组
  createGroup: (name, type = 'user_created') =>
    request('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    }),

  // 解散群组
  dissolveGroup: (groupId) =>
    request(`/groups/${groupId}`, {
      method: 'DELETE',
    }),

  // 获取群成员
  getGroupMembers: (groupId) => request(`/groups/${groupId}/members`),

  // 获取解散冷却状态
  getCooldownStatus: () => request('/groups/my/cooldown'),

  // 获取用户创建的群
  getMyGroup: () => request('/groups/my/owned'),
};

// 消息相关API
export const messageAPI = {
  // 获取群组消息
  getGroupMessages: (groupId) =>
    request(`/groups/${groupId}/messages`),

  // 发送消息
  sendMessage: (groupId, content, type = 'text') =>
    request(`/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type }),
    }),

  // 校验消息长度
  validateMessage: (content) =>
    request('/messages/validate', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

export { request };
