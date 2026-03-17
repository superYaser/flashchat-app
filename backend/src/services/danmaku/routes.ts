/**
 * ============================================================================
 * 快闪群聊App - 弹幕路由
 * ============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import { messageRateLimiter } from '../../middleware/rateLimiter';
import { body } from 'express-validator';
import { ApiResponse, ErrorCode, Danmaku } from '../../../../shared/types';
import { DanmakuService } from './danmaku.service';

const router = Router();
const danmakuService = new DanmakuService();

/**
 * GET /api/v1/danmaku
 * 获取最近弹幕
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const danmakuList = await danmakuService.getRecentDanmaku();

    const response: ApiResponse<Danmaku[]> = {
      code: ErrorCode.SUCCESS,
      data: danmakuList,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/danmaku
 * 发送弹幕（REST备用接口）
 */
router.post(
  '/',
  authMiddleware,
  messageRateLimiter,
  [body('content').isString().trim().notEmpty().withMessage('弹幕内容不能为空')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { content } = req.body;

      const danmaku = await danmakuService.createDanmaku({
        senderId: userId,
        content,
      });

      if (!danmaku) {
        const response: ApiResponse<null> = {
          code: ErrorCode.MESSAGE_TOO_LONG,
          error: ErrorCode.MESSAGE_TOO_LONG,
          message: '弹幕内容过长',
        };
        return res.status(400).json(response);
      }

      const response: ApiResponse<Danmaku> = {
        code: ErrorCode.SUCCESS,
        data: danmaku,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export { router as danmakuRoutes };
