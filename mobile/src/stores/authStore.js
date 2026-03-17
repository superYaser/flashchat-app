import { create } from 'zustand';
import { storage, STORAGE_KEYS } from '../utils/storage';

export const useAuthStore = create((set, get) => ({
  // 状态
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // 初始化（从本地存储加载）
  init: async () => {
    const token = await storage.getItem(STORAGE_KEYS.TOKEN);
    const user = await storage.getItem(STORAGE_KEYS.USER);

    if (token && user) {
      set({ token, user, isAuthenticated: true });
    }
  },

  // 登录
  login: async (userData, token) => {
    await storage.setItem(STORAGE_KEYS.TOKEN, token);
    await storage.setItem(STORAGE_KEYS.USER, userData);
    set({ user: userData, token, isAuthenticated: true, error: null });
  },

  // 登出
  logout: async () => {
    await storage.removeItem(STORAGE_KEYS.TOKEN);
    await storage.removeItem(STORAGE_KEYS.USER);
    set({ user: null, token: null, isAuthenticated: false });
  },

  // 设置加载状态
  setLoading: (loading) => set({ isLoading: loading }),

  // 设置错误
  setError: (error) => set({ error }),

  // 更新用户信息
  updateUser: async (userData) => {
    await storage.setItem(STORAGE_KEYS.USER, userData);
    set({ user: userData });
  },
}));
