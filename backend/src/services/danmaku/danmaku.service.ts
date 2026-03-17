/**
 * ============================================================================
 * 快闪群聊App - 弹幕服务
 * ============================================================================
 * 负责弹幕相关的业务逻辑：
 * - 弹幕创建、查询
 * - 3分钟TTL管理
 * - 轨道分配
 * ============================================================================
 */

import {
  Danmaku,
  UserId,
  DanmakuTrack,
  CONSTANTS,
} from '../../../../shared/types';
import { config } from '../../config';
import { RedisClient } from '../../utils/redis';
import { logger } from '../../utils/logger';

/**
 * 弹幕创建参数
 */
interface CreateDanmakuParams {
  senderId: UserId;
  content: string;
}

/**
 * 弹幕服务类
 */
export class DanmakuService {
  private redis: RedisClient;
  private segmenter: Intl.Segmenter;
  private tracks: DanmakuTrack[] = [];

  constructor() {
    this.redis = RedisClient.getInstance();
    this.segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
    this.initializeTracks();
  }

  /**
   * 初始化弹幕轨道
   */
  private initializeTracks(): void {
    // 假设屏幕高度600px，每条轨道高度30px
    const trackHeight = 30;
    const screenHeight = 600;
    const trackCount = Math.floor(screenHeight / trackHeight);

    for (let i = 0; i < trackCount; i++) {
      this.tracks.push({
        index: i,
        y: i * trackHeight + 50, // 顶部偏移50px
        occupied: false,
        occupiedUntil: 0,
      });
    }
  }

  // ========================================================================
  // 弹幕查询
  // ========================================================================

  /**
   * 获取最近弹幕（3分钟内）
   */
  public async getRecentDanmaku(): Promise<Danmaku[]> {
    const key = 'danmaku:home_page';
    const danmakuList = await this.redis.lrange(key, 0, -1);

    return danmakuList
      .map((str) => this.parseDanmaku(str))
      .filter(Boolean)
      .filter((d) => d && Date.now() - d.createdAt < config.business.danmakuTtlSeconds * 1000) as Danmaku[];
  }

  // ========================================================================
  // 弹幕创建
  // ========================================================================

  /**
   * 创建弹幕
   */
  public async createDanmaku(params: CreateDanmakuParams): Promise<Danmaku | null> {
    const { senderId, content } = params;

    // 1. 长度校验
    const length = this.calculateLengthWithEmoji(content);
    if (length > config.business.maxDanmakuLength) {
      logger.warn(`Danmaku from ${senderId} exceeds length limit`);
      return null;
    }

    // 2. 分配轨道
    const track = this.allocateTrack();
    if (track === null) {
      // 所有轨道都被占用，随机选择一个
      const randomTrack = Math.floor(Math.random() * this.tracks.length);
      return this.createDanmakuWithTrack(params, randomTrack);
    }

    return this.createDanmakuWithTrack(params, track);
  }

  /**
   * 在指定轨道创建弹幕
   */
  private async createDanmakuWithTrack(
    params: CreateDanmakuParams,
    trackIndex: number
  ): Promise<Danmaku> {
    const { senderId, content } = params;

    // 1. 生成弹幕ID
    const danmakuId = `danmaku_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 2. 计算滚动时长（根据内容长度动态调整）
    const duration = this.calculateDuration(content);

    // 3. 构建弹幕对象
    const danmaku: Danmaku = {
      id: danmakuId,
      content,
      senderName: await this.getSenderName(senderId),
      track: trackIndex,
      duration,
      createdAt: Date.now(),
    };

    // 4. 保存到Redis
    await this.saveDanmaku(danmaku);

    // 5. 标记轨道占用
    this.occupyTrack(trackIndex, duration);

    logger.debug(`Danmaku ${danmakuId} created on track ${trackIndex}`);

    return danmaku;
  }

  /**
   * 保存弹幕到Redis
   */
  private async saveDanmaku(danmaku: Danmaku): Promise<void> {
    const key = 'danmaku:home_page';
    const danmakuStr = JSON.stringify(danmaku);

    // 使用LPUSH添加到列表头部（最新在前）
    await this.redis.lpush(key, danmakuStr);

    // 限制列表长度（保留最近100条）
    await this.redis.ltrim(key, 0, 99);

    // 设置TTL（3分钟）
    await this.redis.expire(key, config.business.danmakuTtlSeconds);
  }

  // ========================================================================
  // 轨道管理
  // ========================================================================

  /**
   * 分配空闲轨道
   * 优先选择空旷的轨道
   */
  private allocateTrack(): number | null {
    const now = Date.now();

    // 清理已过期的占用
    for (const track of this.tracks) {
      if (track.occupied && track.occupiedUntil <= now) {
        track.occupied = false;
      }
    }

    // 寻找空闲轨道
    const availableTracks = this.tracks.filter((t) => !t.occupied);
    
    if (availableTracks.length > 0) {
      // 随机选择一个空闲轨道（增加随机性）
      const randomIndex = Math.floor(Math.random() * availableTracks.length);
      return availableTracks[randomIndex].index;
    }

    return null;
  }

  /**
   * 标记轨道占用
   */
  private occupyTrack(trackIndex: number, duration: number): void {
    const track = this.tracks.find((t) => t.index === trackIndex);
    if (track) {
      track.occupied = true;
      track.occupiedUntil = Date.now() + duration;
    }
  }

  // ========================================================================
  // 辅助方法
  // ========================================================================

  /**
   * 计算滚动时长
   * 基础8秒，每10个字符增加1秒
   */
  private calculateDuration(content: string): number {
    const baseDuration = 8000; // 8秒
    const extraDuration = Math.floor(content.length / 10) * 1000;
    return Math.min(baseDuration + extraDuration, 15000); // 最长15秒
  }

  /**
   * 计算文本长度（Emoji算2字符）
   */
  private calculateLengthWithEmoji(text: string): number {
    const segments = Array.from(this.segmenter.segment(text));
    let length = 0;

    for (const { segment } of segments) {
      if (/\p{Emoji_Presentation}/u.test(segment)) {
        length += 2;
      } else {
        length += 1;
      }
    }

    return length;
  }

  /**
   * 获取发送者名称
   */
  private async getSenderName(userId: UserId): Promise<string> {
    const nickname = await this.redis.hget(`user:${userId}`, 'nickname');
    return nickname || `用户${userId.slice(-6)}`;
  }

  /**
   * 解析弹幕JSON
   */
  private parseDanmaku(str: string): Danmaku | null {
    try {
      return JSON.parse(str) as Danmaku;
    } catch {
      return null;
    }
  }
}
