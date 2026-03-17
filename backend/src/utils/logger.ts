/**
 * ============================================================================
 * 快闪群聊App - 日志工具
 * ============================================================================
 * 基于Winston的日志封装
 * ============================================================================
 */

import winston from 'winston';
import { config } from '../config';

/**
 * 创建Winston Logger实例
 */
const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'flashchat-api' },
  transports: [
    // 错误日志
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    // 组合日志
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

/**
 * 开发环境添加控制台输出
 */
if (config.app.env !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export { logger };
