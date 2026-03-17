/**
 * ============================================================================
 * 快闪群聊App - 消息服务
 * ============================================================================
 * 负责消息相关的业务逻辑：
 * - 消息创建、查询、删除
 * - 消息长度校验（含Emoji处理）
 * - 敏感词过滤
 * - 5分钟滚动窗口管理
 * ============================================================================
 */

import {
  Message,
  MessageId,
  GroupId,
  UserId,
  MessageType,
  MessageLengthCheck,
  DisplayMode,
  ErrorCode,
  CONSTANTS,
} from '../../../../shared/types';
import { config } from '../../config';
import { RedisClient } from '../../utils/redis';
import { logger } from '../../utils/logger';

/**
 * 消息创建参数
 */
interface CreateMessageParams {
  groupId: GroupId;
  senderId: UserId;
  content: string;
  type: MessageType;
}

/**
 * 消息服务类
 */
export class MessageService {
  private redis: RedisClient;
  private segmenter: Intl.Segmenter;

  constructor() {
    this.redis = RedisClient.getInstance();
    // 初始化 Intl.Segmenter 用于Emoji处理
    this.segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
  }

  // ========================================================================
  // 消息查询
  // ========================================================================

  /**
   * 获取群组消息列表
   * 仅返回最近5分钟的消息
   */
  public async getGroupMessages(groupId: GroupId): Promise<Message[]> {
    const key = `group:msg:${groupId}`;
    const cutoffTime = Date.now() - config.business.messageTtlSeconds * 1000;

    // 从Sorted Set获取消息（按时间戳排序）
    const messages = await this.redis.zrangebyscore(key, cutoffTime, '+inf');

    return messages.map((msgStr) => this.parseMessage(msgStr)).filter(Boolean) as Message[];
  }

  /**
   * 根据ID获取消息
   */
  public async getMessageById(msgId: MessageId): Promise<Message | null> {
    // 遍历所有群的消息（生产环境应使用单独索引）
    const groupKeys = await this.redis.keys('group:msg:*');
    
    for (const key of groupKeys) {
      const messages = await this.redis.zrange(key, 0, -1);
      for (const msgStr of messages) {
        const msg = this.parseMessage(msgStr);
        if (msg && msg.id === msgId) {
          return msg;
        }
      }
    }

    return null;
  }

  // ========================================================================
  // 消息创建
  // ========================================================================

  /**
   * 创建消息
   * @returns 创建的消息，如果包含敏感词则返回null
   */
  public async createMessage(params: CreateMessageParams): Promise<Message | null> {
    const { groupId, senderId, content, type } = params;

    // 1. 敏感词过滤
    if (this.containsSensitiveWords(content)) {
      logger.warn(`Message from ${senderId} contains sensitive words`);
      return null;
    }

    // 2. 长度校验
    const lengthCheck = this.checkMessageLength(content);
    if (!lengthCheck.valid) {
      throw new Error(lengthCheck.error);
    }

    // 3. 生成消息ID
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 4. 构建消息对象
    const message: Message = {
      id: msgId,
      groupId,
      sender: {
        id: senderId,
        name: await this.getSenderName(senderId),
        type: type === 'system' ? 'system' : 'user',
      },
      content: lengthCheck.displayMode === 'summary' ? lengthCheck.summary! : content,
      type,
      isTruncated: lengthCheck.displayMode === 'summary',
      summary: lengthCheck.summary,
      fullContent: lengthCheck.fullContent,
      deleted: false,
      createdAt: Date.now(),
    };

    // 5. 保存消息
    await this.saveMessage(message);

    // 6. 更新群最后消息时间
    await this.redis.hset(`group:room:${groupId}`, 'last_msg_ts', Date.now().toString());

    logger.debug(`Message ${msgId} created in group ${groupId}`);

    return message;
  }

  /**
   * 保存消息到Redis
   */
  private async saveMessage(message: Message): Promise<void> {
    const key = `group:msg:${message.groupId}`;
    const msgStr = JSON.stringify(message);

    // 添加到Sorted Set（按时间戳排序）
    await this.redis.zadd(key, message.createdAt, msgStr);

    // 设置TTL（5分钟后过期）
    await this.redis.expire(key, config.business.messageTtlSeconds);

    // 清理过期消息
    await this.cleanupExpiredMessages(message.groupId);
  }

  /**
   * 清理过期消息
   */
  private async cleanupExpiredMessages(groupId: GroupId): Promise<void> {
    const key = `group:msg:${groupId}`;
    const cutoffTime = Date.now() - config.business.messageTtlSeconds * 1000;

    // 删除5分钟前的消息
    await this.redis.zremrangebyscore(key, '-inf', cutoffTime);
  }

  // ========================================================================
  // 消息删除
  // ========================================================================

  /**
   * 删除消息（软删除）
   */
  public async deleteMessage(msgId: MessageId): Promise<boolean> {
    const message = await this.getMessageById(msgId);
    if (!message) {
      return false;
    }

    // 标记为已删除
    message.deleted = true;

    // 更新Redis中的消息
    const key = `group:msg:${message.groupId}`;
    const msgStr = JSON.stringify(message);
    
    // 删除旧记录并添加新记录
    await this.redis.zrem(key, JSON.stringify({ ...message, deleted: false }));
    await this.redis.zadd(key, message.createdAt, msgStr);

    logger.debug(`Message ${msgId} marked as deleted`);

    return true;
  }

  // ========================================================================
  // 消息长度校验（Intl.Segmenter标准）
  // ========================================================================

  /**
   * 检查消息长度
   * 采用 Intl.Segmenter 标准处理Emoji
   */
  public checkMessageLength(text: string): MessageLengthCheck {
    const maxLength = config.business.maxMessageLength;
    const summaryThreshold = config.business.summaryThreshold;

    // 计算长度（Emoji算2字符）
    const length = this.calculateLengthWithEmoji(text);

    // 超过最大长度
    if (length > maxLength) {
      return {
        valid: false,
        length,
        maxLength,
        displayMode: 'full',
        error: `消息超过${maxLength}字限制`,
      };
    }

    // 需要生成摘要
    if (length > summaryThreshold) {
      const summary = this.generateSummary(text);
      return {
        valid: true,
        length,
        maxLength,
        displayMode: 'summary',
        summary,
        fullContent: text,
      };
    }

    // 完整显示
    return {
      valid: true,
      length,
      maxLength,
      displayMode: 'full',
    };
  }

  /**
   * 计算文本长度（Emoji算2字符）
   * 使用 Intl.Segmenter 进行准确的字形分割
   */
  public calculateLengthWithEmoji(text: string): number {
    const segments = Array.from(this.segmenter.segment(text));
    let length = 0;

    for (const { segment } of segments) {
      // 判断是否为Emoji（使用Unicode属性转义）
      if (/\p{Emoji_Presentation}/u.test(segment)) {
        length += 2; // Emoji占2字符
      } else {
        length += 1; // 普通字符占1字符
      }
    }

    return length;
  }

  /**
   * 生成摘要（前24字 + ...）
   */
  private generateSummary(text: string): string {
    const segments = Array.from(this.segmenter.segment(text));
    let length = 0;
    let summary = '';

    for (const { segment } of segments) {
      const segmentLength = /\p{Emoji_Presentation}/u.test(segment) ? 2 : 1;
      
      if (length + segmentLength > config.business.summaryThreshold) {
        break;
      }
      
      summary += segment;
      length += segmentLength;
    }

    return summary + '...';
  }

  // ========================================================================
  // 敏感词过滤
  // ========================================================================

  /**
   * 检查是否包含敏感词
   * 使用Trie树算法（简化版，生产环境应使用更高效的实现）
   */
  private containsSensitiveWords(text: string): boolean {
    const sensitiveWords = config.security.sensitiveWords;
    
    for (const word of sensitiveWords) {
      if (text.toLowerCase().includes(word.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  // ========================================================================
  // 辅助方法
  // ========================================================================

  /**
   * 获取发送者名称
   */
  private async getSenderName(userId: UserId): Promise<string> {
    // 从Redis或数据库获取用户昵称
    const nickname = await this.redis.hget(`user:${userId}`, 'nickname');
    return nickname || `用户${userId.slice(-6)}`;
  }

  /**
   * 解析消息JSON
   */
  private parseMessage(msgStr: string): Message | null {
    try {
      return JSON.parse(msgStr) as Message;
    } catch {
      return null;
    }
  }

  /**
   * 格式化消息内容（12字×2行）
   */
  public formatMessageContent(content: string): { line1: string; line2: string } {
    const segments = Array.from(this.segmenter.segment(content));
    let length = 0;
    let line1 = '';
    let line2 = '';
    let currentLine = 1;

    for (const { segment } of segments) {
      const segmentLength = /\p{Emoji_Presentation}/u.test(segment) ? 2 : 1;

      if (currentLine === 1) {
        if (length + segmentLength <= config.business.maxLineLength) {
          line1 += segment;
          length += segmentLength;
        } else {
          currentLine = 2;
          length = 0;
          line2 += segment;
          length += segmentLength;
        }
      } else if (currentLine === 2) {
        if (length + segmentLength <= config.business.maxLineLength) {
          line2 += segment;
          length += segmentLength;
        } else {
          break; // 超过2行，截断
        }
      }
    }

    return { line1, line2 };
  }
}
