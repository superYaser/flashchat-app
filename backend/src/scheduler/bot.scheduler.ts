/**
 * ============================================================================
 * 快闪群聊App - 机器人调度器
 * ============================================================================
 * 负责系统群的自动消息推送：
 * - 定时任务调度（每5-10分钟）
 * - 内容抓取与去重
 * - 消息格式化（12字×2行）
 * ============================================================================
 */

import {
  SystemGroupType,
  SYSTEM_GROUPS,
  Message,
  UserId,
} from '../../../shared/types';
import { config } from '../config';
import { RedisClient } from '../utils/redis';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';

/**
 * 内容源接口
 */
interface ContentSource {
  fetch(keyword: string): Promise<string[]>;
}

/**
 * 机器人调度器类
 */
export class BotScheduler {
  private redis: RedisClient;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private contentSources: ContentSource[] = [];

  constructor() {
    this.redis = RedisClient.getInstance();
  }

  /**
   * 启动调度器
   */
  public start(): void {
    if (!config.business.bot.enabled) {
      logger.info('Bot scheduler is disabled');
      return;
    }

    // 为每个系统群启动定时任务
    for (const [type, sysConfig] of Object.entries(SYSTEM_GROUPS)) {
      this.scheduleBotTask(type as SystemGroupType, sysConfig.interval);
    }

    logger.info('Bot scheduler started');
  }

  /**
   * 停止调度器
   */
  public stop(): void {
    for (const [type, timer] of this.timers) {
      clearInterval(timer);
      logger.info(`Bot task for ${type} stopped`);
    }
    this.timers.clear();
  }

  /**
   * 调度机器人任务
   */
  private scheduleBotTask(type: SystemGroupType, intervalSeconds: number): void {
    // 立即执行一次
    this.executeBotTask(type);

    // 设置定时任务
    const timer = setInterval(() => {
      this.executeBotTask(type);
    }, intervalSeconds * 1000);

    this.timers.set(type, timer);
    logger.info(`Bot task scheduled for ${type}, interval: ${intervalSeconds}s`);
  }

  /**
   * 执行机器人任务
   */
  private async executeBotTask(type: SystemGroupType): Promise<void> {
    try {
      const sysConfig = SYSTEM_GROUPS[type];
      const groupId = `system_${type}`;

      // 1. 抓取内容
      const contents = await this.fetchContent(sysConfig.keyword);
      if (contents.length === 0) {
        logger.warn(`No content fetched for ${type}`);
        return;
      }

      // 2. 去重检查
      const uniqueContent = await this.deduplicateContent(type, contents);
      if (!uniqueContent) {
        logger.info(`All contents are duplicates for ${type}, skipping`);
        return;
      }

      // 3. 格式化消息
      const formattedMessage = this.formatMessage(uniqueContent);

      // 4. 发送消息
      await this.sendBotMessage(groupId, formattedMessage, type);

      // 5. 记录内容Hash
      await this.recordContentHash(type, uniqueContent);

      logger.info(`Bot message sent to ${type}: ${formattedMessage}`);
    } catch (error) {
      logger.error(`Error executing bot task for ${type}:`, error);
    }
  }

  /**
   * 抓取内容
   * 模拟内容抓取，生产环境应接入真实API
   */
  private async fetchContent(keyword: string): Promise<string[]> {
    // TODO: 接入真实的内容源API（搜索引擎、RSS等）
    // 这里使用模拟数据
    const mockContents: Record<SystemGroupType, string[]> = {
      hiking: [
        '今日香山红叶指数90%适合徒步拍照打卡',
        '周末户外徒步活动招募中欢迎报名',
        '秋季登山注意事项保暖装备要齐全',
      ],
      fishing: [
        '今日钓鱼指数良好适合外出垂钓',
        '新钓点分享水质清澈鱼情不错',
        '钓鱼技巧分享如何提高上鱼率',
      ],
      stock: [
        '大盘突破3300点科技股领涨市场关注',
        '今日股市行情三大指数集体上涨',
        '投资理财建议分散投资降低风险',
      ],
      mahjong: [
        '麻将技巧分享如何提高胡牌率',
        '今日麻将运势不错适合娱乐放松',
        '棋牌室推荐环境舒适服务周到',
      ],
      parenting: [
        '亲子教育方法分享如何培养孩子的好习惯',
        '今日育儿知识孩子挑食怎么办',
        '辅导作业技巧如何让孩子主动学习',
      ],
    };

    // 根据关键词匹配类型
    for (const [type, contents] of Object.entries(mockContents)) {
      if (keyword.includes(SYSTEM_GROUPS[type as SystemGroupType].name)) {
        return contents;
      }
    }

    return [];
  }

  /**
   * 内容去重
   * 检查最近24小时内是否发送过相同或相似内容
   */
  private async deduplicateContent(
    type: SystemGroupType,
    contents: string[]
  ): Promise<string | null> {
    const historyKey = `bot:history:${type}`;

    // 获取最近发送的内容Hash
    const recentHashes = await this.redis.zrange(historyKey, -50, -1);
    const recentHashSet = new Set(recentHashes);

    for (const content of contents) {
      const contentHash = this.hashContent(content);
      
      if (!recentHashSet.has(contentHash)) {
        return content;
      }
    }

    return null;
  }

  /**
   * 记录内容Hash
   */
  private async recordContentHash(type: SystemGroupType, content: string): Promise<void> {
    const historyKey = `bot:history:${type}`;
    const contentHash = this.hashContent(content);
    const timestamp = Date.now();

    // 添加到ZSET（按时间排序）
    await this.redis.zadd(historyKey, timestamp, contentHash);

    // 只保留最近50条
    await this.redis.zremrangebyrank(historyKey, 0, -51);

    // 设置24小时过期
    await this.redis.expire(historyKey, 86400);
  }

  /**
   * 计算内容Hash
   */
  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 格式化消息（12字×2行）
   */
  private formatMessage(content: string): string {
    // 简化处理：直接返回内容
    // 生产环境应根据Intl.Segmenter进行精确分割
    return content;
  }

  /**
   * 发送机器人消息
   */
  private async sendBotMessage(
    groupId: string,
    content: string,
    botType: SystemGroupType
  ): Promise<void> {
    // 构建消息对象
    const message: Message = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      groupId,
      sender: {
        id: `bot_${botType}`,
        name: `${SYSTEM_GROUPS[botType].name}助手`,
        type: 'system',
      },
      content,
      type: 'system',
      isTruncated: false,
      deleted: false,
      createdAt: Date.now(),
    };

    // 保存到Redis
    const key = `group:msg:${groupId}`;
    await this.redis.zadd(key, message.createdAt, JSON.stringify(message));
    await this.redis.expire(key, config.business.messageTtlSeconds);

    // 更新热度计数
    const currentMin = Math.floor(Date.now() / 60000) * 60;
    const heatKey = `group:heat:${groupId}:${currentMin}`;
    await this.redis.incr(heatKey);
    await this.redis.expire(heatKey, config.business.heatWindowSeconds);

    // TODO: 通过WebSocket广播消息
    // 这里需要通过WebSocketGateway广播，但为了避免循环依赖，
    // 生产环境应使用消息队列（如Redis Pub/Sub或Kafka）
  }
}
