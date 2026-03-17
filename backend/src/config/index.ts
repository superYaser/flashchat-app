/**
 * ============================================================================
 * 快闪群聊App - 配置文件
 * ============================================================================
 * 集中管理所有配置项，支持环境变量覆盖
 * ============================================================================
 */

import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * 应用配置
 */
export const config = {
  /**
   * 应用基础配置
   */
  app: {
    name: process.env.APP_NAME || 'FlashChat',
    version: process.env.APP_VERSION || '1.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  /**
   * CORS配置
   */
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },

  /**
   * Redis配置
   */
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'flashchat:',
    // 集群配置（生产环境）
    cluster: process.env.REDIS_CLUSTER === 'true',
    clusterNodes: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
  },

  /**
   * MongoDB配置
   */
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/flashchat',
    options: {
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10', 10),
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  /**
   * WebSocket配置
   */
  websocket: {
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '30000', 10),
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '5000', 10),
    maxConnectionsPerUser: parseInt(process.env.WS_MAX_CONNECTIONS || '2', 10),
    reconnect: {
      baseDelay: 1000,
      maxDelay: 30000,
      maxAttempts: 10,
    },
  },

  /**
   * JWT配置
   */
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  /**
   * 业务配置
   */
  business: {
    // 群聊限制
    maxGroupMembers: 20,
    maxUserOwnedGroups: 1,
    
    // 消息限制
    maxMessageLength: 50,
    summaryThreshold: 24,
    maxLineLength: 12,
    maxDisplayLines: 2,
    
    // 弹幕限制
    maxDanmakuLength: 24,
    danmakuTtlSeconds: 180,
    
    // 消息保留时间
    messageTtlSeconds: 300,
    
    // 解散冷却
    dissolveCooldownSeconds: 14400,
    
    // 热度计算
    heatWindowSeconds: 60,
    heatCalcIntervalMs: 10000,
    
    // 防刷限制
    maxMessagesPerMinute: 10,
    
    // 机器人配置
    bot: {
      enabled: process.env.BOT_ENABLED !== 'false',
      contentSources: process.env.BOT_CONTENT_SOURCES?.split(',') || [],
      dedupWindowHours: 24,
      maxHistorySize: 50,
    },
  },

  /**
   * 安全配置
   */
  security: {
    // 敏感词列表（可从文件或数据库加载）
    sensitiveWords: process.env.SENSITIVE_WORDS?.split(',') || [],
    
    // 限流配置
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    },
    
    // IP限制
    ipLimit: {
      maxAccountsPerHour: 3,
    },
  },
} as const;

/**
 * 检查必需的环境变量
 */
export function validateConfig(): void {
  const requiredEnvVars = ['JWT_SECRET'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`Warning: ${envVar} is not set, using default value`);
    }
  }
}

// 导出类型
export type Config = typeof config;
