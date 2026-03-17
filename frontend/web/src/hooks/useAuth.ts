/**
 * ============================================================================
 * 快闪群聊App - 认证Hook
 * ============================================================================
 */

import { useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { userAPI } from '../api/client';
import { User } from '../types';

export function useAuth() {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login: storeLogin,
    logout: storeLogout,
    setLoading,
    setError,
  } = useAuthStore();

  /**
   * 登录
   */
  const login = useCallback(async (phone: string, code: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await userAPI.login(phone, code);

      if (response.code === 0 && response.data) {
        storeLogin(response.data.user, response.data.token);
        return { success: true };
      } else {
        setError(response.message || '登录失败');
        return { success: false, error: response.message };
      }
    } catch (error: any) {
      const message = error.message || '登录失败';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [storeLogin, setLoading, setError]);

  /**
   * 登出
   */
  const logout = useCallback(() => {
    storeLogout();
  }, [storeLogout]);

  /**
   * 获取当前用户
   */
  const getCurrentUser = useCallback(async (): Promise<User | null> => {
    if (!isAuthenticated) return null;

    try {
      const response = await userAPI.getCurrentUser();
      if (response.code === 0 && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }, [isAuthenticated]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    getCurrentUser,
  };
}
