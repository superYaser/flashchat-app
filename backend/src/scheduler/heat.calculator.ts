/**
 * ============================================================================
 * 快闪群聊App - 热度计算器
 * ============================================================================
 * 负责实时计算群组热度并广播更新：
 * - 每10秒计算一次热度
 * - 根据消息量确定热度等级
 * - 广播热度更新事件
 * ============================================================================
 */

import { Server as SocketIOServer } from 'socket.io';
import {
  GroupId,
  HeatLevel,
  HeatUpdateEvent,
  HEAT_LEVEL_CONFIG,
  HEAT_THRESHOLDS,
  SYSTEM_GROUPS,
} from '../../../shared/types';
import { config } from '../config';
import { RedisClient } from '../utils/redis';
import { logger } from '../utils/logger';

/**
 * 热度计算器类
 */
export class HeatCalculator {
  private io: SocketIOServer;
  private redis: RedisClient;
  private timer: NodeJS.Timeout | null = null;
  private lastHeatLevels: Map<GroupId, HeatLevel> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.redis = RedisClient.getInstance();
  }

  /**
   * 启动热度计算器
   */
  public start(): void {
    // 立即执行一次
    this.calculateAllHeatLevels();

    // 设置定时任务（每10秒）
    this.timer = setInterval(() => {
      this.calculateAllHeatLevels();
    }, config.business.heatCalcIntervalMs);

    logger.info('Heat calculator started');
  }

  /**
   * 停止热度计算器
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('Heat calculator stopped');
  }

  /**
   * 计算所有群组的热度
   */
  private async calculateAllHeatLevels(): Promise<void> {
    try {
      // 获取所有系统群
      const systemGroupIds = Object.keys(SYSTEM_GROUPS).map(
        (type) => `system_${type}`
      );

      // 获取所有用户创建的群
      const userGroupIds = await this.redis.smembers('groups:user:active');

      // 合并所有群组ID
      const allGroupIds = [...systemGroupIds, ...userGroupIds];

      // 计算每个群的热度
      for (const groupId of allGroupIds) {
        await this.calculateGroupHeat(groupId);
      }
    } catch (error) {
      logger.error('Error calculating heat levels:', error);
    }
  }

  /**
   * 计算单个群组的热度
   */
  private async calculateGroupHeat(groupId: GroupId): Promise<void> {
    try {
      // 获取当前分钟的消息数
      const currentMin = Math.floor(Date.now() / 60000) * 60;
      const heatKey = `group:heat:${groupId}:${currentMin}`;
      const msgCount = parseInt(await this.redis.get(heatKey) || '0', 10);

      // 确定热度等级
      const heatLevel = this.determineHeatLevel(msgCount);

      // 检查热度是否变化
      const lastLevel = this.lastHeatLevels.get(groupId);
      if (lastLevel === heatLevel) {
        // 热度未变化，跳过广播
        return;
      }

      // 更新热度记录
      this.lastHeatLevels.set(groupId, heatLevel);

      // 更新Redis中的热度等级
      await this.redis.hset(`group:room:${groupId}`, 'heat_level', heatLevel);

      // 构建热度更新事件
      const heatConfig = HEAT_LEVEL_CONFIG[heatLevel];
      const event: HeatUpdateEvent = {
        groupId,
        level: heatLevel,
        color: heatConfig.color,
        msgPerMin: msgCount,
      };

      // 广播热度更新
      this.broadcastHeatUpdate(event);

      logger.debug(`Heat updated for ${groupId}: ${heatLevel} (${msgCount} msg/min)`);
    } catch (error) {
      logger.error(`Error calculating heat for ${groupId}:`, error);
    }
  }

  /**
   * 根据消息数确定热度等级
   */
  private determineHeatLevel(msgCount: number): HeatLevel {
    if (msgCount >= HEAT_THRESHOLDS.extreme) {
      return 'extreme';
    } else if (msgCount >= HEAT_THRESHOLDS.high) {
      return 'high';
    } else if (msgCount >= HEAT_THRESHOLDS.medium) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * 广播热度更新
   */
  private broadcastHeatUpdate(event: HeatUpdateEvent): void {
    // 广播到首页房间
    this.io.to('home').emit('heat_update', event);
  }

  /**
   * 手动触发热度计算（用于测试）
   */
  public async forceCalculate(groupId: GroupId): Promise<HeatUpdateEvent | null> {
    await this.calculateGroupHeat(groupId);
    
    const currentMin = Math.floor(Date.now() / 60000) * 60;
    const heatKey = `group:heat:${groupId}:${currentMin}`;
    const msgCount = parseInt(await this.redis.get(heatKey) || '0', 10);
    const heatLevel = this.determineHeatLevel(msgCount);
    const heatConfig = HEAT_LEVEL_CONFIG[heatLevel];

    return {
      groupId,
      level: heatLevel,
      color: heatConfig.color,
      msgPerMin: msgCount,
    };
  }

  /**
   * 获取群组当前热度
   */
  public async getCurrentHeat(groupId: GroupId): Promise<HeatUpdateEvent | null> {
    const currentMin = Math.floor(Date.now() / 60000) * 60;
    const heatKey = `group:heat:${groupId}:${currentMin}`;
    const msgCount = parseInt(await this.redis.get(heatKey) || '0', 10);
    const heatLevel = this.determineHeatLevel(msgCount);
    const heatConfig = HEAT_LEVEL_CONFIG[heatLevel];

    return {
      groupId,
      level: heatLevel,
      color: heatConfig.color,
      msgPerMin: msgCount,
    };
  }
}
