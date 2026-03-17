/**
 * ============================================================================
 * 快闪群聊App - 限流中间件
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { RedisClient } from '../utils/redis';
import { config } from '../config';
import { ErrorCode } from '../../../shared/types';

// 简单的内存限流（生产环境应使用Redis）
const requestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * 限流中间件
 */
export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = config.security.rateLimit.windowMs;
  const maxRequests = config.security.rateLimit.maxRequests;

  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    // 新窗口
    requestCounts.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    next();
    return;
  }

  if (record.count >= maxRequests) {
    res.status(429).json({
      code: ErrorCode.RATE_LIMITED,
      error: ErrorCode.RATE_LIMITED,
      message: '请求过于频繁，请稍后再试',
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    });
    return;
  }

  record.count++;
  next();
}

/**
 * 消息发送限流
 * 同一用户1分钟内最多发送10条消息
 */
export async function messageRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    next();
    return;
  }

  const redis = RedisClient.getInstance();
  const key = `rate_limit:message:${userId}`;
  
  const count = parseInt(await redis.get(key) || '0', 10);
  
  if (count >= config.business.maxMessagesPerMinute) {
    res.status(429).json({
      code: ErrorCode.RATE_LIMITED,
      error: ErrorCode.RATE_LIMITED,
      message: '发送消息过于频繁，请稍后再试',
    });
    return;
  }

  await redis.incr(key);
  await redis.expire(key, 60);
  
  next();
}
