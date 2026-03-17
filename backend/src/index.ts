/**
 * ============================================================================
 * 快闪群聊App - 后端服务入口
 * ============================================================================
 * 技术栈：Node.js + Express + Socket.IO + Redis + MongoDB
 * 架构：微服务风格，支持水平扩展
 * ============================================================================
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimiter';

// 路由导入
import { userRoutes } from './services/user/routes';
import { groupRoutes } from './services/group/routes';
import { messageRoutes } from './services/message/routes';
import { danmakuRoutes } from './services/danmaku/routes';

// WebSocket 处理器导入
import { WebSocketGateway } from './gateway/websocket.gateway';

// 任务调度器导入
import { BotScheduler } from './scheduler/bot.scheduler';
import { HeatCalculator } from './scheduler/heat.calculator';

// 数据库连接导入
import { RedisClient } from './utils/redis';
import { MongoClient } from './utils/mongo';

/**
 * 应用主类
 * 负责初始化Express应用、WebSocket服务器和数据库连接
 */
class FlashChatApplication {
  public app: express.Application;
  public httpServer: ReturnType<typeof createServer>;
  public io: SocketIOServer;
  public wsGateway: WebSocketGateway;
  
  // 定时任务
  private botScheduler: BotScheduler;
  private heatCalculator: HeatCalculator;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingInterval: config.websocket.pingInterval,
      pingTimeout: config.websocket.pingTimeout,
    });
    
    this.wsGateway = new WebSocketGateway(this.io);
    this.botScheduler = new BotScheduler();
    this.heatCalculator = new HeatCalculator(this.io);
  }

  /**
   * 初始化应用
   */
  public async initialize(): Promise<void> {
    try {
      // 1. 连接数据库
      await this.connectDatabases();
      
      // 2. 配置中间件
      this.configureMiddleware();
      
      // 3. 配置路由
      this.configureRoutes();
      
      // 4. 配置WebSocket
      this.wsGateway.initialize();
      
      // 5. 启动定时任务
      this.startSchedulers();
      
      // 6. 全局错误处理
      this.app.use(errorHandler);
      
      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * 连接数据库
   */
  private async connectDatabases(): Promise<void> {
    // 连接Redis
    await RedisClient.connect(config.redis);
    logger.info('Redis connected');
    
    // 连接MongoDB
    await MongoClient.connect(config.mongodb);
    logger.info('MongoDB connected');
  }

  /**
   * 配置Express中间件
   */
  private configureMiddleware(): void {
    // 安全中间件
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: true,
    }));
    
    // 压缩
    this.app.use(compression());
    
    // 请求体解析
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // 请求日志
    this.app.use(requestLogger);
    
    // 限流
    this.app.use(rateLimiter);
  }

  /**
   * 配置API路由
   */
  private configureRoutes(): void {
    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        version: config.app.version,
      });
    });

    // API路由
    this.app.use('/api/v1/users', userRoutes);
    this.app.use('/api/v1/groups', groupRoutes);
    this.app.use('/api/v1/messages', messageRoutes);
    this.app.use('/api/v1/danmaku', danmakuRoutes);

    // 404处理
    this.app.use((req, res) => {
      res.status(404).json({
        code: 404,
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
      });
    });
  }

  /**
   * 启动定时任务
   */
  private startSchedulers(): void {
    // 启动机器人调度器
    this.botScheduler.start();
    logger.info('Bot scheduler started');
    
    // 启动热度计算器
    this.heatCalculator.start();
    logger.info('Heat calculator started');
  }

  /**
   * 启动服务器
   */
  public start(): void {
    const port = config.app.port;
    
    this.httpServer.listen(port, () => {
      logger.info(`🚀 FlashChat server running on port ${port}`);
      logger.info(`📡 WebSocket server ready`);
      logger.info(`📚 API docs: http://localhost:${port}/api/v1`);
    });
  }

  /**
   * 优雅关闭
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down server...');
    
    // 停止定时任务
    this.botScheduler.stop();
    this.heatCalculator.stop();
    
    // 关闭WebSocket
    this.io.close();
    
    // 关闭数据库连接
    await RedisClient.disconnect();
    await MongoClient.disconnect();
    
    // 关闭HTTP服务器
    this.httpServer.close(() => {
      logger.info('Server shut down complete');
      process.exit(0);
    });
  }
}

// 创建应用实例
const application = new FlashChatApplication();

// 启动应用
application.initialize()
  .then(() => {
    application.start();
  })
  .catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });

// 优雅关闭处理
process.on('SIGTERM', () => application.shutdown());
process.on('SIGINT', () => application.shutdown());

export { application };
