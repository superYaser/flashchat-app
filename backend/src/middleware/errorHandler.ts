/**
 * ============================================================================
 * 快闪群聊App - 错误处理中间件
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ErrorCode, ERROR_MESSAGES } from '../../../shared/types';

/**
 * 自定义错误类
 */
export class AppError extends Error {
  public code: ErrorCode;
  public statusCode: number;

  constructor(code: ErrorCode, message?: string, statusCode: number = 400) {
    super(message || ERROR_MESSAGES[code]);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 记录错误
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // 处理自定义错误
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      error: err.code,
      message: err.message,
    });
    return;
  }

  // 处理其他错误
  res.status(500).json({
    code: ErrorCode.UNKNOWN_ERROR,
    error: ErrorCode.UNKNOWN_ERROR,
    message: '服务器内部错误',
  });
}
