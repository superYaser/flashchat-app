/**
 * ============================================================================
 * 快闪群聊App - MongoDB 客户端
 * ============================================================================
 * 封装MongoDB操作，提供统一的接口
 * ============================================================================
 */

import { MongoClient as Mongo, Db, Collection, Document, Filter, UpdateFilter } from 'mongodb';
import { logger } from './logger';

/**
 * MongoDB配置
 */
interface MongoConfig {
  uri: string;
  options: {
    maxPoolSize: number;
    serverSelectionTimeoutMS: number;
    socketTimeoutMS: number;
  };
}

/**
 * MongoDB客户端类（单例模式）
 */
export class MongoClient {
  private static instance: MongoClient;
  private client: Mongo | null = null;
  private db: Db | null = null;
  private config: MongoConfig | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): MongoClient {
    if (!MongoClient.instance) {
      MongoClient.instance = new MongoClient();
    }
    return MongoClient.instance;
  }

  /**
   * 连接MongoDB
   */
  public async connect(config: MongoConfig): Promise<void> {
    this.config = config;

    this.client = new Mongo(config.uri, config.options);

    await this.client.connect();

    // 从URI中提取数据库名，或使用默认名
    const dbName = new URL(config.uri).pathname.slice(1) || 'flashchat';
    this.db = this.client.db(dbName);

    logger.info('MongoDB connected');
  }

  /**
   * 断开连接
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      logger.info('MongoDB disconnected');
    }
  }

  /**
   * 获取集合
   */
  public getCollection<T extends Document = Document>(name: string): Collection<T> {
    if (!this.db) {
      throw new Error('MongoDB not connected');
    }
    return this.db.collection<T>(name);
  }

  // ========================================================================
  // CRUD 操作
  // ========================================================================

  /**
   * 查找单个文档
   */
  public async findOne<T extends Document = Document>(
    collection: string,
    filter: Filter<T>
  ): Promise<T | null> {
    const coll = this.getCollection<T>(collection);
    const result = await coll.findOne(filter);
    return result as T | null;
  }

  /**
   * 查找多个文档
   */
  public async find<T extends Document = Document>(
    collection: string,
    filter: Filter<T>,
    options?: { limit?: number; skip?: number; sort?: Record<string, 1 | -1> }
  ): Promise<T[]> {
    const coll = this.getCollection<T>(collection);
    let cursor = coll.find(filter);

    if (options?.skip) {
      cursor = cursor.skip(options.skip);
    }
    if (options?.limit) {
      cursor = cursor.limit(options.limit);
    }
    if (options?.sort) {
      cursor = cursor.sort(options.sort);
    }

    const results = await cursor.toArray();
    return results as T[];
  }

  /**
   * 插入单个文档
   */
  public async insertOne<T extends Document = Document>(
    collection: string,
    document: T
  ): Promise<string> {
    const coll = this.getCollection<T>(collection);
    const result = await coll.insertOne(document as any);
    return result.insertedId.toString();
  }

  /**
   * 插入多个文档
   */
  public async insertMany<T extends Document = Document>(
    collection: string,
    documents: T[]
  ): Promise<string[]> {
    const coll = this.getCollection<T>(collection);
    const result = await coll.insertMany(documents as any);
    return Object.values(result.insertedIds).map((id) => id.toString());
  }

  /**
   * 更新单个文档
   */
  public async updateOne<T extends Document = Document>(
    collection: string,
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: { upsert?: boolean }
  ): Promise<boolean> {
    const coll = this.getCollection<T>(collection);
    const result = await coll.updateOne(filter as any, update as any, options);
    return result.modifiedCount > 0 || result.upsertedCount > 0;
  }

  /**
   * 更新多个文档
   */
  public async updateMany<T extends Document = Document>(
    collection: string,
    filter: Filter<T>,
    update: UpdateFilter<T>
  ): Promise<number> {
    const coll = this.getCollection<T>(collection);
    const result = await coll.updateMany(filter as any, update as any);
    return result.modifiedCount;
  }

  /**
   * 删除单个文档
   */
  public async deleteOne<T extends Document = Document>(
    collection: string,
    filter: Filter<T>
  ): Promise<boolean> {
    const coll = this.getCollection<T>(collection);
    const result = await coll.deleteOne(filter as any);
    return result.deletedCount > 0;
  }

  /**
   * 删除多个文档
   */
  public async deleteMany<T extends Document = Document>(
    collection: string,
    filter: Filter<T>
  ): Promise<number> {
    const coll = this.getCollection<T>(collection);
    const result = await coll.deleteMany(filter as any);
    return result.deletedCount;
  }

  /**
   * 计数
   */
  public async count<T extends Document = Document>(
    collection: string,
    filter: Filter<T>
  ): Promise<number> {
    const coll = this.getCollection<T>(collection);
    return await coll.countDocuments(filter as any);
  }

  /**
   * 获取原始MongoDB客户端（用于高级操作）
   */
  public getClient(): Mongo | null {
    return this.client;
  }

  /**
   * 获取数据库实例
   */
  public getDb(): Db | null {
    return this.db;
  }
}

