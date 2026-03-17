/**
 * ============================================================================
 * 快闪群聊App - 群组服务
 * ============================================================================
 * 负责群组相关的业务逻辑：
 * - 群组创建、解散、查询
 * - 成员管理
 * - 热度计算
 * - 解散冷却管理
 * ============================================================================
 */

import {
  Group,
  GroupId,
  UserId,
  GroupType,
  SystemGroupType,
  HeatLevel,
  HeatUpdateEvent,
  HEAT_LEVEL_CONFIG,
  HEAT_THRESHOLDS,
  SYSTEM_GROUPS,
  DissolveCooldown,
  ErrorCode,
  Position,
} from '../../../../shared/types';
import { config } from '../../config';
import { RedisClient } from '../../utils/redis';
import { MongoClient } from '../../utils/mongo';
import { logger } from '../../utils/logger';

/**
 * 群组服务类
 */
export class GroupService {
  private redis: RedisClient;
  private mongo: MongoClient;

  constructor() {
    this.redis = RedisClient.getInstance();
    this.mongo = MongoClient.getInstance();
  }

  // ========================================================================
  // 群组查询
  // ========================================================================

  /**
   * 根据ID获取群组
   */
  public async getGroupById(groupId: GroupId): Promise<Group | null> {
    // 先从Redis获取
    const groupData = await this.redis.hgetall(`group:room:${groupId}`);
    
    if (Object.keys(groupData).length > 0) {
      return this.parseGroupFromRedis(groupId, groupData);
    }

    // Redis未命中，从MongoDB获取
    const group = await this.mongo.findOne('groups', { id: groupId });
    if (group) {
      // 缓存到Redis
      await this.cacheGroup(group);
      return group;
    }

    return null;
  }

  /**
   * 获取首页群组列表
   * 包括5个系统群和所有用户创建的群
   */
  public async getHomeGroups(): Promise<Group[]> {
    const groups: Group[] = [];

    // 1. 获取系统群
    for (const [key, sysGroup] of Object.entries(SYSTEM_GROUPS)) {
      const group = await this.getOrCreateSystemGroup(sysGroup.id);
      if (group) {
        groups.push(group);
      }
    }

    // 2. 获取用户创建的群
    const userGroups = await this.getActiveUserGroups();
    groups.push(...userGroups);

    // 3. 计算热度
    for (const group of groups) {
      group.heatLevel = await this.calculateHeatLevel(group.id);
      group.heatColor = HEAT_LEVEL_CONFIG[group.heatLevel].color;
    }

    return groups;
  }

  /**
   * 获取活跃的用户群组
   */
  private async getActiveUserGroups(): Promise<Group[]> {
    // 从Redis获取所有用户群ID
    const groupIds = await this.redis.smembers('groups:user:active');
    
    const groups: Group[] = [];
    for (const groupId of groupIds) {
      const group = await this.getGroupById(groupId);
      if (group && group.type === 'user_created') {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * 获取或创建系统群
   */
  private async getOrCreateSystemGroup(type: SystemGroupType): Promise<Group | null> {
    const groupId = `system_${type}`;
    let group = await this.getGroupById(groupId);

    if (!group) {
      // 创建系统群
      const sysConfig = SYSTEM_GROUPS[type];
      group = {
        id: groupId,
        name: sysConfig.name,
        type: 'system',
        memberCount: 0,
        maxMembers: config.business.maxGroupMembers,
        heatLevel: 'low',
        heatColor: HEAT_LEVEL_CONFIG.low.color,
        isSystem: true,
        createdAt: Date.now(),
        position: this.generateRandomPosition(),
      };

      await this.saveGroup(group);
    }

    return group;
  }

  // ========================================================================
  // 群组创建与解散
  // ========================================================================

  /**
   * 创建群组
   */
  public async createGroup(
    ownerId: UserId,
    name: string
  ): Promise<{ group: Group; error?: ErrorCode }> {
    // 1. 检查用户是否已有创建的群
    const existingGroup = await this.getUserOwnedGroup(ownerId);
    if (existingGroup) {
      return { group: null as any, error: ErrorCode.ALREADY_OWN_GROUP };
    }

    // 2. 检查解散冷却
    const cooldown = await this.getDissolveCooldown(ownerId);
    if (cooldown && cooldown.remainingSeconds > 0) {
      return { group: null as any, error: ErrorCode.COOLDOWN_ACTIVE };
    }

    // 3. 创建群组
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const group: Group = {
      id: groupId,
      name: name.slice(0, 8), // 最多8个汉字
      type: 'user_created',
      ownerId,
      memberCount: 1, // 群主自己
      maxMembers: config.business.maxGroupMembers,
      heatLevel: 'low',
      heatColor: HEAT_LEVEL_CONFIG.low.color,
      isSystem: false,
      createdAt: Date.now(),
      position: this.generateRandomPosition(),
    };

    // 4. 保存群组
    await this.saveGroup(group);

    // 5. 记录用户创建的群
    await this.redis.set(`user:owned:${ownerId}`, groupId);
    await this.redis.sadd('groups:user:active', groupId);

    // 6. 添加群主为成员
    await this.addMember(groupId, ownerId);

    logger.info(`Group ${groupId} created by user ${ownerId}`);

    return { group };
  }

  /**
   * 解散群组
   */
  public async dissolveGroup(groupId: GroupId, ownerId: UserId): Promise<boolean> {
    const group = await this.getGroupById(groupId);
    
    if (!group) {
      return false;
    }

    if (group.ownerId !== ownerId) {
      return false;
    }

    // 1. 标记群已解散
    await this.redis.setex(`group:dissolved:${groupId}`, 3600, '1');

    // 2. 设置解散冷却
    const dissolveTime = Date.now();
    const cooldownKey = `user:dissolve:cooldown:${ownerId}`;
    await this.redis.setex(
      cooldownKey,
      config.business.dissolveCooldownSeconds,
      dissolveTime.toString()
    );

    // 3. 清理群数据
    await this.cleanupGroupData(groupId);

    // 4. 从用户拥有的群记录中移除
    await this.redis.del(`user:owned:${ownerId}`);
    await this.redis.srem('groups:user:active', groupId);

    logger.info(`Group ${groupId} dissolved by owner ${ownerId}`);

    return true;
  }

  /**
   * 清理群数据
   */
  private async cleanupGroupData(groupId: GroupId): Promise<void> {
    // 删除群成员
    await this.redis.del(`group:members:${groupId}`);
    
    // 删除群消息
    await this.redis.del(`group:msg:${groupId}`);
    
    // 删除热度计数
    await this.redis.del(`group:heat:${groupId}:min`);
    
    // 删除群信息
    await this.redis.del(`group:room:${groupId}`);

    // 从MongoDB归档（可选）
    await this.mongo.updateOne(
      'groups',
      { id: groupId },
      { $set: { dissolvedAt: Date.now(), status: 'dissolved' } }
    );
  }

  // ========================================================================
  // 成员管理
  // ========================================================================

  /**
   * 添加成员
   */
  public async addMember(groupId: GroupId, userId: UserId): Promise<boolean> {
    const group = await this.getGroupById(groupId);
    if (!group) {
      return false;
    }

    if (group.memberCount >= config.business.maxGroupMembers) {
      return false;
    }

    // 添加到成员集合
    await this.redis.sadd(`group:members:${groupId}`, userId);
    
    // 更新成员数
    await this.redis.hincrby(`group:room:${groupId}`, 'member_count', 1);
    
    // 记录用户加入的群
    await this.redis.sadd(`user:groups:${userId}`, groupId);

    return true;
  }

  /**
   * 移除成员
   */
  public async removeMember(groupId: GroupId, userId: UserId): Promise<boolean> {
    // 从成员集合移除
    await this.redis.srem(`group:members:${groupId}`, userId);
    
    // 更新成员数
    await this.redis.hincrby(`group:room:${groupId}`, 'member_count', -1);
    
    // 从用户群列表移除
    await this.redis.srem(`user:groups:${userId}`, groupId);

    return true;
  }

  /**
   * 获取群成员列表
   */
  public async getGroupMembers(groupId: GroupId): Promise<UserId[]> {
    return await this.redis.smembers(`group:members:${groupId}`);
  }

  /**
   * 检查是否是群主
   */
  public async isGroupOwner(groupId: GroupId, userId: UserId): Promise<boolean> {
    const group = await this.getGroupById(groupId);
    return group?.ownerId === userId;
  }

  /**
   * 获取用户创建的群
   */
  public async getUserOwnedGroup(userId: UserId): Promise<Group | null> {
    const groupId = await this.redis.get(`user:owned:${userId}`);
    if (groupId) {
      return await this.getGroupById(groupId);
    }
    return null;
  }

  // ========================================================================
  // 热度计算
  // ========================================================================

  /**
   * 增加热度计数
   */
  public async incrementHeatCount(groupId: GroupId): Promise<void> {
    const currentMin = Math.floor(Date.now() / 60000) * 60;
    const key = `group:heat:${groupId}:${currentMin}`;
    
    await this.redis.incr(key);
    await this.redis.expire(key, config.business.heatWindowSeconds);
  }

  /**
   * 计算热度等级
   */
  public async calculateHeatLevel(groupId: GroupId): Promise<HeatLevel> {
    const currentMin = Math.floor(Date.now() / 60000) * 60;
    const key = `group:heat:${groupId}:${currentMin}`;
    
    const count = parseInt(await this.redis.get(key) || '0', 10);

    if (count >= HEAT_THRESHOLDS.extreme) {
      return 'extreme';
    } else if (count >= HEAT_THRESHOLDS.high) {
      return 'high';
    } else if (count >= HEAT_THRESHOLDS.medium) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * 获取热度更新事件数据
   */
  public async getHeatUpdateEvent(groupId: GroupId): Promise<HeatUpdateEvent | null> {
    const group = await this.getGroupById(groupId);
    if (!group) return null;

    const currentMin = Math.floor(Date.now() / 60000) * 60;
    const key = `group:heat:${groupId}:${currentMin}`;
    const msgPerMin = parseInt(await this.redis.get(key) || '0', 10);

    const heatLevel = await this.calculateHeatLevel(groupId);
    const config = HEAT_LEVEL_CONFIG[heatLevel];

    return {
      groupId,
      level: heatLevel,
      color: config.color,
      msgPerMin,
    };
  }

  // ========================================================================
  // 解散冷却
  // ========================================================================

  /**
   * 获取解散冷却信息
   */
  public async getDissolveCooldown(userId: UserId): Promise<DissolveCooldown | null> {
    const key = `user:dissolve:cooldown:${userId}`;
    const ttl = await this.redis.ttl(key);
    
    if (ttl <= 0) {
      return null;
    }

    const dissolvedAt = parseInt(await this.redis.get(key) || '0', 10);
    const expiresAt = dissolvedAt + config.business.dissolveCooldownSeconds * 1000;

    return {
      userId,
      dissolvedAt,
      expiresAt,
      remainingSeconds: ttl,
    };
  }

  // ========================================================================
  // 辅助方法
  // ========================================================================

  /**
   * 保存群组
   */
  private async saveGroup(group: Group): Promise<void> {
    // 保存到Redis
    await this.redis.hmset(`group:room:${group.id}`, {
      owner_id: group.ownerId || '',
      member_count: group.memberCount.toString(),
      created_at: group.createdAt.toString(),
      heat_level: group.heatLevel,
      last_msg_ts: group.lastMessageAt?.toString() || '',
      name: group.name,
      type: group.type,
      is_system: group.isSystem.toString(),
    });

    // 保存到MongoDB
    await this.mongo.updateOne(
      'groups',
      { id: group.id },
      { $set: group },
      { upsert: true }
    );
  }

  /**
   * 缓存群组到Redis
   */
  private async cacheGroup(group: Group): Promise<void> {
    await this.redis.hmset(`group:room:${group.id}`, {
      owner_id: group.ownerId || '',
      member_count: group.memberCount.toString(),
      created_at: group.createdAt.toString(),
      heat_level: group.heatLevel,
      last_msg_ts: group.lastMessageAt?.toString() || '',
      name: group.name,
      type: group.type,
      is_system: group.isSystem.toString(),
    });
  }

  /**
   * 从Redis数据解析群组
   */
  private parseGroupFromRedis(groupId: GroupId, data: Record<string, string>): Group {
    return {
      id: groupId,
      name: data.name,
      type: data.type as GroupType,
      ownerId: data.owner_id || undefined,
      memberCount: parseInt(data.member_count, 10),
      maxMembers: config.business.maxGroupMembers,
      heatLevel: (data.heat_level as HeatLevel) || 'low',
      heatColor: HEAT_LEVEL_CONFIG[(data.heat_level as HeatLevel) || 'low'].color,
      isSystem: data.is_system === 'true',
      createdAt: parseInt(data.created_at, 10),
      lastMessageAt: data.last_msg_ts ? parseInt(data.last_msg_ts, 10) : undefined,
    };
  }

  /**
   * 生成随机位置（首页游走）
   */
  private generateRandomPosition(): Position {
    // 假设屏幕尺寸为 375x812 (iPhone标准)
    const screenWidth = 375;
    const screenHeight = 600; // 排除底部操作区
    
    return {
      x: Math.random() * (screenWidth - 100) + 50,
      y: Math.random() * (screenHeight - 100) + 50,
    };
  }
}
