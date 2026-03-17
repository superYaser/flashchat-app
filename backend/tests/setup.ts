/**
 * ============================================================================
 * 快闪群聊App - 测试设置
 * ============================================================================
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.MONGODB_URI = 'mongodb://localhost:27017/flashchat_test';

// 全局测试超时
jest.setTimeout(30000);

// 清理函数
afterAll(async () => {
  // 清理资源
});
