/**
 * ============================================================================
 * 快闪群聊App - 认证中间件
 * ============================================================================
 * 处理JWT认证和WebSocket认证
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserId, ErrorCode } from '../../../shared/types';

/**
 * JWT Payload
 */
interface JWTPayload {
  userId: UserId;
  iat: number;
  exp: number;
}

/**
 * 扩展Express Request类型
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: UserId;
      };
    }
  }
}

/**
 * HTTP认证中间件
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // 开发环境跳过认证（可选）
  if (config.app.env === 'development' && !req.headers.authorization) {
    req.user = { id: 'dev_user_123' };
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      code: ErrorCode.UNAUTHORIZED,
      error: ErrorCode.UNAUTHORIZED,
      message: '缺少认证令牌',
    });
    return;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      code: ErrorCode.UNAUTHORIZED,
      error: ErrorCode.UNAUTHORIZED,
      message: '认证格式无效',
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    res.status(401).json({
      code: ErrorCode.UNAUTHORIZED,
      error: ErrorCode.UNAUTHORIZED,
      message: '认证令牌无效或已过期',
    });
  }
};

/**
 * WebSocket认证中间件
 */
export const wsAuthMiddleware = (socket: Socket, next: (err?: Error) => void): void => {
  // 开发环境跳过认证（可选）
  if (config.app.env === 'development') {
    socket.data.userId = 'dev_user_123';
    return next();
  }

  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }

  try {
    const decoded = jwt.verify(token as string, config.jwt.secret) as JWTPayload;
    socket.data.userId = decoded.userId;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

/**
 * 可选认证中间件（不强制要求登录）
 */
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next();
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    req.user = { id: decoded.userId };
  } catch {
    // 忽略验证错误，继续作为未登录用户
  }

  next();
};

/**
 * 生成JWT令牌
 */
export function generateToken(userId: UserId): string {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * 生成刷新令牌
 */
export function generateRefreshToken(userId: UserId): string {
  return jwt.sign({ userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}
