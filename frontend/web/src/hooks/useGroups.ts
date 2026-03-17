/**
 * ============================================================================
 * 快闪群聊App - 群组Hook
 * ============================================================================
 */

import { useState, useCallback, useEffect } from 'react';
import { groupAPI } from '../api/client';
import { Group, CreateGroupRequest, DissolveCooldown } from '../types';

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroup, setMyGroup] = useState<Group | null>(null);
  const [cooldown, setCooldown] = useState<DissolveCooldown | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取首页群组列表
   */
  const fetchHomeGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await groupAPI.getHomeGroups();
      if (response.code === 0 && response.data) {
        setGroups(response.data);
      } else {
        setError(response.message || '获取群组列表失败');
      }
    } catch (err: any) {
      setError(err.message || '获取群组列表失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 获取用户创建的群
   */
  const fetchMyGroup = useCallback(async () => {
    try {
      const response = await groupAPI.getMyGroup();
      if (response.code === 0) {
        setMyGroup(response.data || null);
      }
    } catch {
      // 忽略错误
    }
  }, []);

  /**
   * 获取解散冷却状态
   */
  const fetchCooldownStatus = useCallback(async () => {
    try {
      const response = await groupAPI.getCooldownStatus();
      if (response.code === 0) {
        setCooldown(response.data || null);
      }
    } catch {
      // 忽略错误
    }
  }, []);

  /**
   * 创建群组
   */
  const createGroup = useCallback(async (data: CreateGroupRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await groupAPI.createGroup(data);

      if (response.code === 0 && response.data) {
        await fetchMyGroup();
        return { success: true, groupId: response.data.groupId };
      } else {
        setError(response.message || '创建群组失败');
        return { success: false, error: response.message };
      }
    } catch (err: any) {
      const message = err.message || '创建群组失败';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [fetchMyGroup]);

  /**
   * 解散群组
   */
  const dissolveGroup = useCallback(async (groupId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await groupAPI.dissolveGroup(groupId);

      if (response.code === 0) {
        await fetchMyGroup();
        await fetchCooldownStatus();
        return { success: true };
      } else {
        setError(response.message || '解散群组失败');
        return { success: false, error: response.message };
      }
    } catch (err: any) {
      const message = err.message || '解散群组失败';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [fetchMyGroup, fetchCooldownStatus]);

  // 初始加载
  useEffect(() => {
    fetchHomeGroups();
    fetchMyGroup();
    fetchCooldownStatus();
  }, [fetchHomeGroups, fetchMyGroup, fetchCooldownStatus]);

  return {
    groups,
    myGroup,
    cooldown,
    isLoading,
    error,
    fetchHomeGroups,
    fetchMyGroup,
    createGroup,
    dissolveGroup,
  };
}

