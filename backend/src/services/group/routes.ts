/**
 * ============================================================================
 * 快闪群聊App - 群组路由
 * ============================================================================
 * RESTful API 路由定义
 * ============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';
import { GroupService } from './group.service';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import { ApiResponse, ErrorCode, CreateGroupRequest } from '../../../../shared/types';
import { body } from 'express-validator';

const router = Router();
const groupService = new GroupService();

/**
 * GET /api/v1/groups
 * 获取首页群组列表
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = await groupService.getHomeGroups();
    
    const response: ApiResponse<typeof groups> = {
      code: ErrorCode.SUCCESS,
      data: groups,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/groups
 * 创建群组
 */
router.post(
  '/',
  authMiddleware,
  [
    body('name')
      .isString()
      .trim()
      .isLength({ min: 1, max: 8 })
      .withMessage('群名称长度必须在1-8个字符之间'),
    body('type').isIn(['user_created']).withMessage('群组类型无效'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { name, type } = req.body as CreateGroupRequest;

      const result = await groupService.createGroup(userId, name);

      if (result.error) {
        const response: ApiResponse<null> = {
          code: result.error,
          error: result.error,
          message: getErrorMessage(result.error),
        };
        return res.status(400).json(response);
      }

      const response: ApiResponse<typeof result.group> = {
        code: ErrorCode.SUCCESS,
        data: result.group,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/groups/:groupId
 * 获取群组详情
 */
router.get('/:groupId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const group = await groupService.getGroupById(groupId);

    if (!group) {
      const response: ApiResponse<null> = {
        code: ErrorCode.GROUP_NOT_FOUND,
        error: ErrorCode.GROUP_NOT_FOUND,
        message: '群组不存在',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof group> = {
      code: ErrorCode.SUCCESS,
      data: group,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/groups/:groupId
 * 解散群组
 */
router.delete('/:groupId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { groupId } = req.params;

    const success = await groupService.dissolveGroup(groupId, userId);

    if (!success) {
      const response: ApiResponse<null> = {
        code: ErrorCode.FORBIDDEN,
        error: ErrorCode.FORBIDDEN,
        message: '只有群主可以解散群组',
      };
      return res.status(403).json(response);
    }

    // TODO: 通过WebSocket广播强制离开事件
    // 这里需要通过某种方式通知WebSocketGateway

    const response: ApiResponse<null> = {
      code: ErrorCode.SUCCESS,
      data: null,
      message: '群组已解散',
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/groups/:groupId/members
 * 获取群成员列表
 */
router.get('/:groupId/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const members = await groupService.getGroupMembers(groupId);

    const response: ApiResponse<typeof members> = {
      code: ErrorCode.SUCCESS,
      data: members,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/groups/my/cooldown
 * 获取解散冷却状态
 */
router.get('/my/cooldown', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const cooldown = await groupService.getDissolveCooldown(userId);

    const response: ApiResponse<typeof cooldown> = {
      code: ErrorCode.SUCCESS,
      data: cooldown,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/groups/my/owned
 * 获取用户创建的群
 */
router.get('/my/owned', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const group = await groupService.getUserOwnedGroup(userId);

    const response: ApiResponse<typeof group> = {
      code: ErrorCode.SUCCESS,
      data: group,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * 获取错误消息
 */
function getErrorMessage(errorCode: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.SUCCESS]: '成功',
    [ErrorCode.UNKNOWN_ERROR]: '未知错误',
    [ErrorCode.INVALID_PARAMS]: '参数错误',
    [ErrorCode.UNAUTHORIZED]: '未授权',
    [ErrorCode.FORBIDDEN]: '禁止访问',
    [ErrorCode.NOT_FOUND]: '资源不存在',
    [ErrorCode.USER_NOT_FOUND]: '用户不存在',
    [ErrorCode.USER_ALREADY_EXISTS]: '用户已存在',
    [ErrorCode.GROUP_NOT_FOUND]: '群组不存在',
    [ErrorCode.GROUP_ALREADY_EXISTS]: '群组已存在',
    [ErrorCode.GROUP_FULL]: '群组已满员',
    [ErrorCode.COOLDOWN_ACTIVE]: '解散冷却中，4小时内无法创建新群',
    [ErrorCode.ALREADY_OWN_GROUP]: '您已有创建的群，可解散后重新创建',
    [ErrorCode.NOT_GROUP_OWNER]: '不是群主',
    [ErrorCode.MESSAGE_TOO_LONG]: '消息过长',
    [ErrorCode.MESSAGE_CONTAINS_SENSITIVE_WORDS]: '消息包含敏感词',
    [ErrorCode.RATE_LIMITED]: '发送过于频繁',
    [ErrorCode.WS_CONNECTION_LIMIT]: '连接数超限',
  };

  return messages[errorCode] || '未知错误';
}

export { router as groupRoutes };
