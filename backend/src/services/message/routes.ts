/**
 * ============================================================================
 * 快闪群聊App - 消息路由
 * ============================================================================
 * RESTful API 路由定义
 * ============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';
import { MessageService } from './message.service';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import { ApiResponse, ErrorCode } from '../../../../shared/types';
import { body, param } from 'express-validator';

const router = Router({ mergeParams: true });
const messageService = new MessageService();

/**
 * GET /api/v1/groups/:groupId/messages
 * 获取群组消息列表
 */
router.get(
  '/',
  [param('groupId').isString().withMessage('群组ID无效')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.params;
      const messages = await messageService.getGroupMessages(groupId);

      const response: ApiResponse<typeof messages> = {
        code: ErrorCode.SUCCESS,
        data: messages,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/groups/:groupId/messages
 * 发送消息（REST备用接口）
 */
router.post(
  '/',
  authMiddleware,
  [
    param('groupId').isString().withMessage('群组ID无效'),
    body('content')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('消息内容不能为空'),
    body('type').optional().isIn(['text', 'system']).withMessage('消息类型无效'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { groupId } = req.params;
      const { content, type = 'text' } = req.body;

      // 长度校验
      const lengthCheck = messageService.checkMessageLength(content);
      if (!lengthCheck.valid) {
        const response: ApiResponse<null> = {
          code: ErrorCode.MESSAGE_TOO_LONG,
          error: ErrorCode.MESSAGE_TOO_LONG,
          message: lengthCheck.error,
        };
        return res.status(400).json(response);
      }

      // 创建消息
      const message = await messageService.createMessage({
        groupId,
        senderId: userId,
        content,
        type,
      });

      if (!message) {
        const response: ApiResponse<null> = {
          code: ErrorCode.MESSAGE_CONTAINS_SENSITIVE_WORDS,
          error: ErrorCode.MESSAGE_CONTAINS_SENSITIVE_WORDS,
          message: '消息包含敏感词',
        };
        return res.status(400).json(response);
      }

      const response: ApiResponse<typeof message> = {
        code: ErrorCode.SUCCESS,
        data: message,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/groups/:groupId/messages/:msgId
 * 删除消息（仅群主）
 */
router.delete(
  '/:msgId',
  authMiddleware,
  [
    param('groupId').isString().withMessage('群组ID无效'),
    param('msgId').isString().withMessage('消息ID无效'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { msgId } = req.params;

      const success = await messageService.deleteMessage(msgId);

      if (!success) {
        const response: ApiResponse<null> = {
          code: ErrorCode.NOT_FOUND,
          error: ErrorCode.NOT_FOUND,
          message: '消息不存在',
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse<null> = {
        code: ErrorCode.SUCCESS,
        data: null,
        message: '消息已删除',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/messages/validate
 * 校验消息长度（用于前端实时校验）
 */
router.post(
  '/validate',
  [body('content').isString().withMessage('内容必须是字符串')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { content } = req.body;
      const result = messageService.checkMessageLength(content);

      const response: ApiResponse<typeof result> = {
        code: ErrorCode.SUCCESS,
        data: result,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export { router as messageRoutes };
