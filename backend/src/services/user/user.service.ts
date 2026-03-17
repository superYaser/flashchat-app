/**
 * ============================================================================
 * 快闪群聊App - 用户服务
 * ============================================================================
 * 负责用户相关的业务逻辑
 * ============================================================================
 */

import { User, UserId } from '../../../../shared/types';
import { RedisClient } from '../../utils/redis';
import { MongoClient } from '../../utils/mongo';
import { logger } from '../../utils/logger';

/**
 * 用户服务类
 */
export class UserService {
  private redis: RedisClient;
  private mongo: MongoClient;

  constructor() {
    this.redis = RedisClient.getInstance();
    this.mongo = MongoClient.getInstance();
  }

  /**
   * 根据ID获取用户
   */
  public async getUserById(userId: UserId): Promise<User | null> {
    // 先从Redis获取
    const userData = await this.redis.hgetall(`user:${userId}`);
    
    if (Object.keys(userData).length > 0) {
      return this.parseUserFromRedis(userId, userData);
    }

    // Redis未命中，从MongoDB获取
    const user = await this.mongo.findOne('users', { id: userId });
    if (user) {
      // 缓存到Redis
      await this.cacheUser(user);
      return user;
    }

    return null;
  }

  /**
   * 创建用户
   */
  public async createUser(userId: UserId, nickname: string): Promise<User> {
    const user: User = {
      id: userId,
      nickname,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 保存到Redis
    await this.cacheUser(user);

    // 保存到MongoDB
    await this.mongo.insertOne('users', user);

    logger.info(`User ${userId} created`);

    return user;
  }

  /**
   * 更新用户信息
   */
  public async updateUser(userId: UserId, updates: Partial<User>): Promise<User | null> {
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: Date.now(),
    };

    // 更新Redis
    await this.cacheUser(updatedUser);

    // 更新MongoDB
    await this.mongo.updateOne(
      'users',
      { id: userId },
      { $set: updatedUser }
    );

    logger.info(`User ${userId} updated`);

    return updatedUser;
  }

  /**
   * 获取或创建用户
   */
  public async getOrCreateUser(userId: UserId, nickname: string): Promise<User> {
    let user = await this.getUserById(userId);
    
    if (!user) {
      user = await this.createUser(userId, nickname);
    }

    return user;
  }

  /**
   * 缓存用户到Redis
   */
  private async cacheUser(user: User): Promise<void> {
    await this.redis.hmset(`user:${user.id}`, {
      nickname: user.nickname,
      avatar: user.avatar || '',
      created_at: user.createdAt.toString(),
      updated_at: user.updatedAt.toString(),
    });
  }

  /**
   * 从Redis数据解析用户
   */
  private parseUserFromRedis(userId: UserId, data: Record<string, string>): User {
    return {
      id: userId,
      nickname: data.nickname,
      avatar: data.avatar || undefined,
      createdAt: parseInt(data.created_at, 10),
      updatedAt: parseInt(data.updated_at, 10),
    };
  }
}
