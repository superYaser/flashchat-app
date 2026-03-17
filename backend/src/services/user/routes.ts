/**
 * ============================================================================
 * 快闪群聊App - 用户路由
 * ============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, generateToken } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import { body } from 'express-validator';
import { ApiResponse, ErrorCode, User } from '../../../../shared/types';
import { RedisClient } from '../../utils/redis';

const router = Router();
const redis = RedisClient.getInstance();

/**
 * POST /api/v1/users/login
 * 用户登录（简化版，实际应使用手机号+验证码）
 */
router.post(
  '/login',
  [
    body('phone').isMobilePhone('zh-CN').withMessage('手机号格式不正确'),
    body('code').isLength({ min: 4, max: 6 }).withMessage('验证码长度不正确'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone, code } = req.body;

      // TODO: 验证验证码
      // 简化处理：直接创建或获取用户

      const userId = `user_${phone.slice(-8)}`;
      
      // 检查用户是否存在
      let user = await redis.hgetall(`user:${userId}`);
      
      if (Object.keys(user).length === 0) {
        // 创建新用户
        const newUser: User = {
          id: userId,
          nickname: `用户${phone.slice(-4)}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await redis.hmset(`user:${userId}`, {
          nickname: newUser.nickname,
          created_at: newUser.createdAt.toString(),
          updated_at: newUser.updatedAt.toString(),
        });

        user = {
          nickname: newUser.nickname,
          created_at: newUser.createdAt.toString(),
          updated_at: newUser.updatedAt.toString(),
        };
      }

      // 生成JWT令牌
      const token = generateToken(userId);

      const response: ApiResponse<{ user: User; token: string }> = {
        code: ErrorCode.SUCCESS,
        data: {
          user: {
            id: userId,
            nickname: user.nickname,
            createdAt: parseInt(user.created_at, 10),
            updatedAt: parseInt(user.updated_at, 10),
          },
          token,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/users/me
 * 获取当前用户信息
 */
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const userData = await redis.hgetall(`user:${userId}`);

    if (Object.keys(userData).length === 0) {
      const response: ApiResponse<null> = {
        code: ErrorCode.USER_NOT_FOUND,
        error: ErrorCode.USER_NOT_FOUND,
        message: '用户不存在',
      };
      return res.status(404).json(response);
    }

    const user: User = {
      id: userId,
      nickname: userData.nickname,
      avatar: userData.avatar,
      createdAt: parseInt(userData.created_at, 10),
      updatedAt: parseInt(userData.updated_at, 10),
    };

    const response: ApiResponse<User> = {
      code: ErrorCode.SUCCESS,
      data: user,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/users/me
 * 更新用户信息
 */
router.patch(
  '/me',
  authMiddleware,
  [body('nickname').optional().isLength({ min: 1, max: 20 }).withMessage('昵称长度1-20个字符')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { nickname } = req.body;

      if (nickname) {
        await redis.hset(`user:${userId}`, 'nickname', nickname);
        await redis.hset(`user:${userId}`, 'updated_at', Date.now().toString());
      }

      const userData = await redis.hgetall(`user:${userId}`);
      const user: User = {
        id: userId,
        nickname: userData.nickname,
        avatar: userData.avatar,
        createdAt: parseInt(userData.created_at, 10),
        updatedAt: parseInt(userData.updated_at, 10),
      };

      const response: ApiResponse<User> = {
        code: ErrorCode.SUCCESS,
        data: user,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export { router as userRoutes };
