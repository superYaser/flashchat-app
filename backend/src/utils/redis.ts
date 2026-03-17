/**
 * ============================================================================
 * 快闪群聊App - Redis 客户端
 * ============================================================================
 * 封装Redis操作，提供统一的接口
 * ============================================================================
 */

import Redis from 'ioredis';
import { logger } from './logger';

/**
 * Redis配置
 */
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  cluster: boolean;
  clusterNodes: string[];
}

/**
 * Redis客户端类（单例模式）
 */
export class RedisClient {
  private static instance: RedisClient;
  private client: Redis | null = null;
  private config: RedisConfig | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  /**
   * 连接Redis
   */
  public async connect(config: RedisConfig): Promise<void> {
    this.config = config;

    if (config.cluster) {
      // 集群模式
      const nodes = config.clusterNodes.map((node) => {
        const [host, port] = node.split(':');
        return { host, port: parseInt(port, 10) };
      });

      this.client = new Redis.Cluster(nodes, {
        redisOptions: {
          password: config.password,
          db: config.db,
        },
      }) as any;
    } else {
      // 单机模式
      this.client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        keyPrefix: config.keyPrefix,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    }

    // 监听连接事件
    this.client.on('connect', () => {
      logger.info('Redis connected');
    });

    this.client.on('error', (error) => {
      logger.error('Redis error:', error);
    });

    this.client.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });
  }

  /**
   * 断开连接
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis disconnected');
    }
  }

  // ========================================================================
  // String 操作
  // ========================================================================

  public async get(key: string): Promise<string | null> {
    return this.client?.get(key) || null;
  }

  public async set(key: string, value: string): Promise<void> {
    await this.client?.set(key, value);
  }

  public async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.client?.setex(key, seconds, value);
  }

  public async del(key: string): Promise<void> {
    await this.client?.del(key);
  }

  public async incr(key: string): Promise<number> {
    return (await this.client?.incr(key)) || 0;
  }

  public async expire(key: string, seconds: number): Promise<void> {
    await this.client?.expire(key, seconds);
  }

  public async ttl(key: string): Promise<number> {
    return (await this.client?.ttl(key)) || -1;
  }

  // ========================================================================
  // Hash 操作
  // ========================================================================

  public async hget(key: string, field: string): Promise<string | null> {
    return this.client?.hget(key, field) || null;
  }

  public async hgetall(key: string): Promise<Record<string, string>> {
    return (await this.client?.hgetall(key)) || {};
  }

  public async hset(key: string, field: string, value: string): Promise<void> {
    await this.client?.hset(key, field, value);
  }

  public async hmset(key: string, obj: Record<string, string>): Promise<void> {
    await this.client?.hmset(key, obj);
  }

  public async hincrby(key: string, field: string, increment: number): Promise<number> {
    return (await this.client?.hincrby(key, field, increment)) || 0;
  }

  // ========================================================================
  // Set 操作
  // ========================================================================

  public async sadd(key: string, ...members: string[]): Promise<number> {
    return (await this.client?.sadd(key, ...members)) || 0;
  }

  public async srem(key: string, ...members: string[]): Promise<number> {
    return (await this.client?.srem(key, ...members)) || 0;
  }

  public async smembers(key: string): Promise<string[]> {
    return (await this.client?.smembers(key)) || [];
  }

  // ========================================================================
  // Sorted Set 操作
  // ========================================================================

  public async zadd(key: string, score: number, member: string): Promise<number> {
    return (await this.client?.zadd(key, score, member)) || 0;
  }

  public async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return (await this.client?.zrange(key, start, stop)) || [];
  }

  public async zrangebyscore(key: string, min: string | number, max: string | number): Promise<string[]> {
    return (await this.client?.zrangebyscore(key, min, max)) || [];
  }

  public async zremrangebyscore(key: string, min: string | number, max: string | number): Promise<number> {
    return (await this.client?.zremrangebyscore(key, min, max)) || 0;
  }

  public async zremrangebyrank(key: string, start: number, stop: number): Promise<number> {
    return (await this.client?.zremrangebyrank(key, start, stop)) || 0;
  }

  public async zscore(key: string, member: string): Promise<string | null> {
    return this.client?.zscore(key, member) || null;
  }

  // ========================================================================
  // List 操作
  // ========================================================================

  public async lpush(key: string, ...values: string[]): Promise<number> {
    return (await this.client?.lpush(key, ...values)) || 0;
  }

  public async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return (await this.client?.lrange(key, start, stop)) || [];
  }

  public async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.client?.ltrim(key, start, stop);
  }

  // ========================================================================
  // 其他操作
  // ========================================================================

  public async keys(pattern: string): Promise<string[]> {
    return (await this.client?.keys(pattern)) || [];
  }

  /**
   * 获取原始Redis客户端（用于高级操作）
   */
  public getClient(): Redis | null {
    return this.client;
  }
}

