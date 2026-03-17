/**
 * ============================================================================
 * 快闪群聊App - 请求验证中间件
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ErrorCode } from '../../../shared/types';

/**
 * 请求验证中间件
 * 处理express-validator的验证结果
 */
export function validateRequest(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    
    res.status(400).json({
      code: ErrorCode.INVALID_PARAMS,
      error: ErrorCode.INVALID_PARAMS,
      message: firstError.msg,
      details: errors.array(),
    });
    return;
  }

  next();
}
