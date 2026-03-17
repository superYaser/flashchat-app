/**
 * ============================================================================
 * 快闪群聊App - 后端服务器 (FlashChat Backend Server)
 * ============================================================================
 * 
 * 功能模块：
 * 1. 用户认证（注册/登录/JWT Token）
 * 2. 群组管理（创建/解散/查询）
 * 3. 消息系统（发送/接收/5分钟生命周期）
 * 4. 弹幕系统（首页实时弹幕）
 * 5. 内容审核（敏感词过滤）
 * 
 * 技术栈：
 * - Node.js + Express
 * - Socket.io (WebSocket实时通信)
 * - Redis (消息缓存、冷却期管理)
 * - MongoDB (数据持久化)
 * - JWT (用户认证)
 * 
 * 作者：AI Assistant
 * 创建日期：2024-03-18
 * ============================================================================
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Redis = require('ioredis');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ============================================================================
// 服务器初始化
// ============================================================================

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// JWT密钥 - 生产环境应从环境变量读取
const JWT_SECRET = process.env.JWT_SECRET || 'flashchat-secret-key-2024';

// Redis客户端 - 用于缓存和冷却期管理
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

// MongoDB连接
let db;
let usersCollection;      // 用户集合
let groupsCollection;     // 群组集合
let messagesCollection;   // 消息集合
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flashchat';

// 内存存储 - 当MongoDB不可时的降级方案
const memoryUsers = new Map();    // 内存用户存储
const memoryGroups = new Map();   // 内存群组存储
const memoryMessages = new Map(); // 内存消息存储

// ============================================================================
// 中间件配置
// ============================================================================

app.use(cors());              // 跨域支持
app.use(express.json());      // JSON解析

// ============================================================================
// 敏感词过滤配置
// ============================================================================

/** 
 * 敏感词列表 - 用于内容审核
 * 发送消息时如果包含这些词会被拦截
 */
const SENSITIVE_WORDS = ['测试', '垃圾', '混蛋', '傻逼', '他妈的', 'fuck', 'shit'];

/**
 * 检查内容是否包含敏感词
 * @param {string} content - 要检查的内容
 * @returns {boolean} - 是否包含敏感词
 */
function containsSensitiveWord(content) {
  for (const word of SENSITIVE_WORDS) {
    if (content.toLowerCase().includes(word.toLowerCase())) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// 系统群配置
// ============================================================================

/**
 * 5个系统群 - 首页固定显示
 * 每个群有位置、热度等级、人数等属性
 */
const SYSTEM_GROUPS = [
  { 
    id: 'system_hiking', 
    name: '徒步', 
    type: 'system', 
    memberCount: 12, 
    maxMembers: 20, 
    heatLevel: 'medium', 
    heatColor: '#4A90E2', 
    isSystem: true, 
    createdAt: Date.now(), 
    position: { x: '10%', y: '15%' } 
  },
  { 
    id: 'system_fishing', 
    name: '钓鱼', 
    type: 'system', 
    memberCount: 8, 
    maxMembers: 20, 
    heatLevel: 'low', 
    heatColor: '#999999', 
    isSystem: true, 
    createdAt: Date.now(), 
    position: { x: '60%', y: '20%' } 
  },
  { 
    id: 'system_stock', 
    name: '股票', 
    type: 'system', 
    memberCount: 15, 
    maxMembers: 20, 
    heatLevel: 'high', 
    heatColor: '#F5A623', 
    isSystem: true, 
    createdAt: Date.now(), 
    position: { x: '30%', y: '45%' } 
  },
  { 
    id: 'system_mahjong', 
    name: '麻将', 
    type: 'system', 
    memberCount: 6, 
    maxMembers: 20, 
    heatLevel: 'low', 
    heatColor: '#999999', 
    isSystem: true, 
    createdAt: Date.now(), 
    position: { x: '70%', y: '50%' } 
  },
  { 
    id: 'system_parenting', 
    name: '辅导小孩', 
    type: 'system', 
    memberCount: 10, 
    maxMembers: 20, 
    heatLevel: 'medium', 
    heatColor: '#4A90E2', 
    isSystem: true, 
    createdAt: Date.now(), 
    position: { x: '20%', y: '70%' } 
  }
];

// ============================================================================
// REST API 路由
// ============================================================================

/**
 * 健康检查接口
 * 用于监控服务器状态
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), version: '1.0.0' });
});

// ============================================================================
// 用户认证 API
// ============================================================================

/**
 * 用户注册 API
 * POST /api/v1/users/register
 * 
 * 请求体：{ name: string, password: string }
 * 响应：{ code: 0, data: { user, token } }
 * 
 * 限制：
 * - 用户名2-20字符
 * - 密码至少6字符
 * - 用户名不能重复
 */
app.post('/api/v1/users/register', async (req, res) => {
  try {
    const { name, password } = req.body;

    // 参数校验
    if (!name || !password) {
      return res.json({ code: 400, message: '用户名和密码不能为空' });
    }

    if (name.length < 2 || name.length > 20) {
      return res.json({ code: 400, message: '用户名长度必须在2-20个字符之间' });
    }

    // 检查用户是否已存在
    let existingUser = null;
    if (usersCollection) {
      existingUser = await usersCollection.findOne({ name });
    } else {
      existingUser = memoryUsers.get(name);
    }

    if (existingUser) {
      return res.json({ code: 409, message: '用户名已存在' });
    }

    // 创建用户
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const user = {
      id: userId,
      name,
      password: hashedPassword,
      type: 'user',
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };

    // 保存用户
    if (usersCollection) {
      await usersCollection.insertOne(user);
    } else {
      memoryUsers.set(name, user);
    }

    // 生成JWT token
    const token = jwt.sign({ userId: user.id, name: user.name, type: user.type }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      code: 0,
      data: {
        user: { id: user.id, name: user.name, type: user.type },
        token
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.json({ code: 500, message: '注册失败' });
  }
});

/**
 * 用户登录 API
 * POST /api/v1/users/login
 * 
 * 请求体：{ name: string, password: string }
 * 响应：{ code: 0, data: { user, token } }
 */
app.post('/api/v1/users/login', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.json({ code: 400, message: '用户名和密码不能为空' });
    }

    // 查找用户
    let user = null;
    if (usersCollection) {
      user = await usersCollection.findOne({ name });
    } else {
      user = memoryUsers.get(name);
    }

    if (!user) {
      return res.json({ code: 401, message: '用户名或密码错误' });
    }

    // 验证密码
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    if (user.password !== hashedPassword) {
      return res.json({ code: 401, message: '用户名或密码错误' });
    }

    // 更新最后登录时间
    if (usersCollection) {
      await usersCollection.updateOne({ id: user.id }, { $set: { lastLoginAt: Date.now() } });
    }

    // 生成JWT token
    const token = jwt.sign({ userId: user.id, name: user.name, type: user.type }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      code: 0,
      data: {
        user: { id: user.id, name: user.name, type: user.type },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.json({ code: 500, message: '登录失败' });
  }
});

/**
 * 获取当前用户信息 API
 * GET /api/v1/users/me
 * 
 * 需要认证头：Authorization: Bearer <token>
 */
app.get('/api/v1/users/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ code: 401, message: '未登录' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    res.json({
      code: 0,
      data: { id: decoded.userId, name: decoded.name, type: decoded.type }
    });
  } catch (error) {
    res.json({ code: 401, message: '登录已过期' });
  }
});

// ============================================================================
// 群组管理 API
// ============================================================================

/**
 * 获取群组列表 API
 * GET /api/v1/groups
 * 
 * 返回所有用户创建的群（不包括系统群）
 */
app.get('/api/v1/groups', async (req, res) => {
  try {
    // 只获取所有用户创建的群（不包括系统群）
    let userGroups = [];
    if (groupsCollection) {
      userGroups = await groupsCollection.find({ isSystem: { $ne: true } }).toArray();
    } else {
      for (const group of memoryGroups.values()) {
        if (!group.isSystem) {
          userGroups.push(group);
        }
      }
    }

    res.json({ code: 0, data: userGroups });
  } catch (error) {
    console.error('Get groups error:', error);
    res.json({ code: 500, message: '获取群组列表失败' });
  }
});

/**
 * 获取单个群组详情 API
 * GET /api/v1/groups/:groupId
 */
app.get('/api/v1/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;

    // 先查系统群
    let group = SYSTEM_GROUPS.find(g => g.id === groupId);

    // 再查用户群
    if (!group) {
      if (groupsCollection) {
        group = await groupsCollection.findOne({ id: groupId });
      } else {
        group = memoryGroups.get(groupId);
      }
    }

    if (!group) {
      return res.json({ code: 404, message: '群组不存在' });
    }

    res.json({ code: 0, data: group });
  } catch (error) {
    console.error('Get group error:', error);
    res.json({ code: 500, message: '获取群组详情失败' });
  }
});

/**
 * 创建群聊 API
 * POST /api/v1/groups
 * 
 * 限制：
 * - 每人只能创建一个群
 * - 解散后4小时冷却期
 * - 群名称最多8字符
 */
app.post('/api/v1/groups', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ code: 401, message: '未登录' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // 检查冷却期（先检查冷却期，因为用户可能刚解散群）
    const cooldownKey = `cooldown:${userId}`;
    let inCooldown = false;
    let cooldownRemaining = null;

    try {
      const cooldownStr = await redis.get(cooldownKey);
      if (cooldownStr) {
        const dissolvedAt = parseInt(cooldownStr);
        const now = Date.now();
        const fourHours = 4 * 60 * 60 * 1000;
        const remaining = dissolvedAt + fourHours - now;

        if (remaining > 0) {
          inCooldown = true;
          const hours = Math.floor(remaining / (60 * 60 * 1000));
          const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
          cooldownRemaining = { hours, minutes };
        }
      }
    } catch (e) {
      // Redis不可用
    }

    if (inCooldown) {
      return res.json({ 
        code: 403, 
        message: `解散冷却中，剩余${cooldownRemaining.hours}小时${cooldownRemaining.minutes}分` 
      });
    }

    // 检查用户是否已有创建的群
    let existingGroup = null;
    if (groupsCollection) {
      existingGroup = await groupsCollection.findOne({ ownerId: userId });
    } else {
      for (const group of memoryGroups.values()) {
        if (group.ownerId === userId) {
          existingGroup = group;
          break;
        }
      }
    }

    if (existingGroup) {
      return res.json({ code: 409, message: '您已有创建的群，可解散后重新创建' });
    }

    const { name, type = 'user_created' } = req.body;

    if (!name || name.length > 8) {
      return res.json({ code: 400, message: '群名称不能为空且最多8个字符' });
    }

    // 创建新群组
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newGroup = {
      id: groupId,
      name: name,
      type: type,
      memberCount: 1,
      maxMembers: 20,
      heatLevel: 'low',
      heatColor: '#999999',
      isSystem: false,
      ownerId: userId,
      createdAt: Date.now(),
      position: { x: `${10 + Math.random() * 60}%`, y: `${10 + Math.random() * 60}%` }
    };

    // 保存群组
    if (groupsCollection) {
      await groupsCollection.insertOne(newGroup);
    } else {
      memoryGroups.set(groupId, newGroup);
    }

    console.log('Group created:', newGroup);

    res.json({
      code: 0,
      data: {
        groupId: groupId,
        name: name,
        type: type
      }
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.json({ code: 500, message: '创建群组失败' });
  }
});

/**
 * 解散群聊 API
 * DELETE /api/v1/groups/:groupId
 * 
 * 只有群主可以解散群聊
 * 解散后进入4小时冷却期
 */
app.delete('/api/v1/groups/:groupId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ code: 401, message: '未登录' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const { groupId } = req.params;

    // 查找群组
    let group = null;
    if (groupsCollection) {
      group = await groupsCollection.findOne({ id: groupId });
    } else {
      group = memoryGroups.get(groupId);
    }

    if (!group) {
      return res.json({ code: 404, message: '群组不存在' });
    }

    if (group.ownerId !== userId) {
      return res.json({ code: 403, message: '只有群主可以解散群聊' });
    }

    // 删除群组
    if (groupsCollection) {
      await groupsCollection.deleteOne({ id: groupId });
    } else {
      memoryGroups.delete(groupId);
    }

    // 设置冷却期
    const cooldownKey = `cooldown:${userId}`;
    const now = Date.now();
    try {
      await redis.set(cooldownKey, now.toString(), 'EX', 4 * 60 * 60); // 4小时
    } catch (e) {
      // Redis不可用
    }

    // 广播群解散消息
    io.to(`group:${groupId}`).emit('force_leave', {
      groupId,
      reason: 'group_dissolved'
    });

    console.log('Group dissolved:', groupId);

    res.json({
      code: 0,
      data: { dissolvedAt: now }
    });
  } catch (error) {
    console.error('Dissolve group error:', error);
    res.json({ code: 500, message: '解散群聊失败' });
  }
});

/**
 * 获取用户创建的群 API
 * GET /api/v1/groups/my/owned
 */
app.get('/api/v1/groups/my/owned', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ code: 401, message: '未登录' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // 查找用户创建的群
    let ownedGroup = null;
    if (groupsCollection) {
      ownedGroup = await groupsCollection.findOne({ ownerId: userId });
    } else {
      for (const group of memoryGroups.values()) {
        if (group.ownerId === userId) {
          ownedGroup = group;
          break;
        }
      }
    }

    res.json({
      code: 0,
      data: ownedGroup
    });
  } catch (error) {
    console.error('Get owned group error:', error);
    res.json({ code: 500, message: '获取群信息失败' });
  }
});

/**
 * 获取解散冷却状态 API
 * GET /api/v1/groups/my/cooldown
 */
app.get('/api/v1/groups/my/cooldown', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ code: 401, message: '未登录' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // 查找用户的冷却记录
    const cooldownKey = `cooldown:${userId}`;
    let cooldownData = null;

    try {
      const cooldownStr = await redis.get(cooldownKey);
      if (cooldownStr) {
        const dissolvedAt = parseInt(cooldownStr);
        const now = Date.now();
        const fourHours = 4 * 60 * 60 * 1000;
        const remaining = Math.max(0, dissolvedAt + fourHours - now);

        if (remaining > 0) {
          const hours = Math.floor(remaining / (60 * 60 * 1000));
          const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
          cooldownData = {
            dissolvedAt,
            remaining,
            hours,
            minutes,
            canCreate: false
          };
        }
      }
    } catch (e) {
      // Redis不可用
    }

    res.json({
      code: 0,
      data: cooldownData
    });
  } catch (error) {
    console.error('Get cooldown error:', error);
    res.json({ code: 500, message: '获取冷却状态失败' });
  }
});

/**
 * 获取群组成员 API
 * GET /api/v1/groups/:groupId/members
 */
app.get('/api/v1/groups/:groupId/members', async (req, res) => {
  try {
    const { groupId } = req.params;

    // 返回模拟成员列表
    const members = [
      { id: 'user_1', name: '小明', type: 'user', isOnline: true },
      { id: 'user_2', name: '小红', type: 'user', isOnline: true },
      { id: 'user_3', name: '张三', type: 'user', isOnline: false }
    ];

    res.json({ code: 0, data: members });
  } catch (error) {
    console.error('Get members error:', error);
    res.json({ code: 500, message: '获取成员列表失败' });
  }
});

// ============================================================================
// 消息相关 API
// ============================================================================

/**
 * 获取群组消息 API
 * GET /api/v1/groups/:groupId/messages
 * 
 * 只返回最近5分钟内的消息
 */
app.get('/api/v1/groups/:groupId/messages', async (req, res) => {
  try {
    const { groupId } = req.params;

    // 获取最近5分钟的消息
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    let messages = [];
    if (messagesCollection) {
      messages = await messagesCollection
        .find({ groupId, createdAt: { $gte: fiveMinutesAgo }, deleted: { $ne: true } })
        .sort({ createdAt: 1 })
        .limit(100)
        .toArray();
    } else {
      // 从内存中筛选
      for (const msg of memoryMessages.values()) {
        if (msg.groupId === groupId && msg.createdAt >= fiveMinutesAgo && !msg.deleted) {
          messages.push(msg);
        }
      }
      messages.sort((a, b) => a.createdAt - b.createdAt);
    }

    res.json({
      code: 0,
      data: {
        messages,
        total: messages.length
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.json({ code: 500, message: '获取消息失败' });
  }
});

/**
 * 发送消息 API (REST备用接口)
 * POST /api/v1/groups/:groupId/messages
 * 
 * 限制：
 * - 最多50字符
 * - Emoji占2字符
 * - 超过24字显示摘要
 */
app.post('/api/v1/groups/:groupId/messages', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ code: 401, message: '未登录' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const userName = decoded.name;

    const { groupId } = req.params;
    const { content, type = 'text' } = req.body;

    if (!content || content.length === 0) {
      return res.json({ code: 400, message: '消息内容不能为空' });
    }

    // 检查敏感词
    if (containsSensitiveWord(content)) {
      return res.json({ code: 403, message: '消息包含敏感内容' });
    }

    // 检查消息长度（使用Intl.Segmenter标准，Emoji占2字符）
    const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
    const segments = Array.from(segmenter.segment(content));
    let charCount = 0;
    for (const segment of segments) {
      // Emoji占2字符
      if (/\p{Emoji}/u.test(segment.segment)) {
        charCount += 2;
      } else {
        charCount += 1;
      }
    }

    if (charCount > 50) {
      return res.json({ code: 400, message: '消息内容不能超过50字符' });
    }

    // 检查是否显示摘要
    const isTruncated = charCount > 24;
    const displayContent = isTruncated ? content.substring(0, 24) : content;

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      groupId: groupId,
      sender: { id: userId, name: userName, type: 'user' },
      content: content,
      displayContent: displayContent,
      type: type,
      isTruncated: isTruncated,
      deleted: false,
      createdAt: Date.now()
    };

    // 保存消息
    if (messagesCollection) {
      await messagesCollection.insertOne(message);
    } else {
      memoryMessages.set(message.id, message);
    }

    // 广播消息
    io.to(`group:${groupId}`).emit('group_message', message);

    res.json({
      code: 0,
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.json({ code: 500, message: '发送消息失败' });
  }
});

/**
 * 删除消息 API
 * DELETE /api/v1/groups/:groupId/messages/:msgId
 * 
 * 只有群主可以删除消息
 */
app.delete('/api/v1/groups/:groupId/messages/:msgId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ code: 401, message: '未登录' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const { groupId, msgId } = req.params;

    // 查找消息
    let message = null;
    if (messagesCollection) {
      message = await messagesCollection.findOne({ id: msgId });
    } else {
      message = memoryMessages.get(msgId);
    }

    if (!message) {
      return res.json({ code: 404, message: '消息不存在' });
    }

    // 检查是否是群主
    let group = null;
    if (groupsCollection) {
      group = await groupsCollection.findOne({ id: groupId });
    } else {
      group = memoryGroups.get(groupId);
    }

    if (!group || group.ownerId !== userId) {
      return res.json({ code: 403, message: '只有群主可以删除消息' });
    }

    // 标记消息为已删除
    if (messagesCollection) {
      await messagesCollection.updateOne({ id: msgId }, { $set: { deleted: true } });
    } else {
      message.deleted = true;
      memoryMessages.set(msgId, message);
    }

    // 广播消息删除
    io.to(`group:${groupId}`).emit('message_removed', { msgId });

    res.json({
      code: 0,
      data: { msgId }
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.json({ code: 500, message: '删除消息失败' });
  }
});

/**
 * 校验消息长度 API
 * POST /api/v1/messages/validate
 * 
 * 使用Intl.Segmenter计算字符数，Emoji占2字符
 */
app.post('/api/v1/messages/validate', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.json({ code: 400, message: '内容不能为空' });
    }

    // 使用Intl.Segmenter计算字符数
    const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
    const segments = Array.from(segmenter.segment(content));
    let charCount = 0;
    for (const segment of segments) {
      if (/\p{Emoji}/u.test(segment.segment)) {
        charCount += 2;
      } else {
        charCount += 1;
      }
    }

    const valid = charCount <= 50;
    const displayMode = charCount > 24 ? 'summary' : 'full';
    const summary = charCount > 24 ? content.substring(0, 24) + '…' : content;

    res.json({
      code: 0,
      data: {
        valid,
        length: charCount,
        maxLength: 50,
        displayMode,
        summary,
        fullContent: content
      }
    });
  } catch (error) {
    console.error('Validate message error:', error);
    res.json({ code: 500, message: '校验失败' });
  }
});

// ============================================================================
// WebSocket 实时通信
// ============================================================================

// 连接用户映射：socketId -> userInfo
const connectedUsers = new Map();

// 群组房间映射：groupId -> Set of socketIds
const groupRooms = new Map();

/**
 * WebSocket连接处理
 */
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 发送欢迎消息
  socket.emit('connected', { socketId: socket.id, timestamp: Date.now() });

  // ========================================================================
  // 首页相关事件
  // ========================================================================

  /**
   * 加入首页
   * 客户端连接后发送此事件加入首页房间
   */
  socket.on('join_home', (data) => {
    console.log('User joined home:', socket.id, data);
    socket.join('home');

    // 发送首页初始化数据（系统群+用户群）
    // 注意：实际应该从数据库获取最新的用户群列表
    let allGroups = [...SYSTEM_GROUPS];
    for (const group of memoryGroups.values()) {
      if (!group.isSystem) {
        allGroups.push(group);
      }
    }

    socket.emit('home_init', {
      groups: allGroups,
      danmakuHistory: []
    });
    console.log('Sent home_init with', allGroups.length, 'groups');
  });

  /**
   * 离开首页
   */
  socket.on('leave_home', () => {
    console.log('User left home:', socket.id);
    socket.leave('home');
  });

  // ========================================================================
  // 弹幕相关事件
  // ========================================================================

  /**
   * 发送弹幕
   * 弹幕会广播给所有在首页的用户
   */
  socket.on('send_danmaku', (data) => {
    console.log('Danmaku received from', socket.id, ':', data);

    const userInfo = connectedUsers.get(socket.id);
    const senderId = userInfo ? userInfo.id : `guest_${socket.id}`;
    const senderName = userInfo ? userInfo.name : (data.senderName || '匿名用户');

    const danmaku = {
      id: `danmaku_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      senderId: senderId,
      senderName: senderName,
      content: data.content,
      track: Math.floor(Math.random() * 5), // 5条轨道
      duration: 8000 + Math.random() * 4000, // 8-12秒
      createdAt: Date.now()
    };

    // 广播给所有在首页的用户
    io.to('home').emit('danmaku', danmaku);
    console.log('Danmaku broadcasted to home:', danmaku);
  });

  // ========================================================================
  // 群组相关事件
  // ========================================================================

  /**
   * 加入群组
   * 用户进入群聊页面时发送此事件
   */
  socket.on('join_group', (data) => {
    const { groupId, token } = data;
    console.log('User joined group:', groupId, socket.id);

    const room = `group:${groupId}`;
    socket.join(room);

    // 记录用户加入的群组
    if (!groupRooms.has(groupId)) {
      groupRooms.set(groupId, new Set());
    }
    groupRooms.get(groupId).add(socket.id);

    // 验证用户
    let userInfo = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userInfo = { id: decoded.userId, name: decoded.name, type: decoded.type };
        connectedUsers.set(socket.id, userInfo);
      } catch (e) {
        console.log('Token invalid, using guest');
      }
    }

    if (!userInfo) {
      userInfo = { id: `guest_${socket.id}`, name: '游客', type: 'guest' };
      connectedUsers.set(socket.id, userInfo);
    }

    // 获取群组信息
    let group = SYSTEM_GROUPS.find(g => g.id === groupId);
    if (!group) {
      group = memoryGroups.get(groupId);
    }
    if (!group) {
      group = { id: groupId, name: '未知群组', memberCount: 1 };
    }

    // 发送群组初始化数据
    socket.emit('group_init', {
      group: group,
      messages: [],
      userInfo: userInfo
    });

    // 广播用户加入消息
    socket.to(room).emit('user_joined', {
      userId: userInfo.id,
      name: userInfo.name,
      timestamp: Date.now()
    });
  });

  /**
   * 离开群组
   */
  socket.on('leave_group', (data) => {
    const { groupId } = data;
    const room = `group:${groupId}`;
    socket.leave(room);

    // 从群组记录中移除
    if (groupRooms.has(groupId)) {
      groupRooms.get(groupId).delete(socket.id);
    }

    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      socket.to(room).emit('user_left', {
        userId: userInfo.id,
        name: userInfo.name,
        timestamp: Date.now()
      });
    }
  });

  // ========================================================================
  // 消息相关事件
  // ========================================================================

  /**
   * 发送消息
   * 消息只会在当前群内广播
   */
  socket.on('send_message', (data) => {
    const { groupId, content, type = 'text' } = data;
    const room = `group:${groupId}`;

    const userInfo = connectedUsers.get(socket.id) || { id: `guest_${socket.id}`, name: '游客', type: 'guest' };

    // 检查敏感词
    if (containsSensitiveWord(content)) {
      socket.emit('error', { code: 403, message: '消息包含敏感内容' });
      return;
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      groupId: groupId,
      sender: { id: userInfo.id, name: userInfo.name, type: userInfo.type },
      content: content,
      type: type,
      isTruncated: false,
      deleted: false,
      createdAt: Date.now()
    };

    // 广播给房间内所有人（包括发送者）
    io.to(room).emit('group_message', message);
    console.log('Message sent to room', room, ':', message.content);
  });

  // ========================================================================
  // 断开连接处理
  // ========================================================================

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    connectedUsers.delete(socket.id);

    // 从所有群组中移除
    for (const [groupId, sockets] of groupRooms.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        const userInfo = connectedUsers.get(socket.id);
        if (userInfo) {
          io.to(`group:${groupId}`).emit('user_left', {
            userId: userInfo.id,
            name: userInfo.name,
            timestamp: Date.now()
          });
        }
      }
    }
  });
});

// ============================================================================
// 服务器启动
// ============================================================================

/**
 * 启动服务器
 * 连接MongoDB和Redis，然后启动HTTP服务
 */
async function start() {
  try {
    // 尝试连接MongoDB
    const mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    db = mongoClient.db();
    usersCollection = db.collection('users');
    groupsCollection = db.collection('groups');
    messagesCollection = db.collection('messages');
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.log('⚠️ MongoDB not available, using memory storage');
  }

  // 尝试连接Redis
  try {
    await redis.ping();
    console.log('✅ Redis connected');
  } catch (error) {
    console.log('⚠️ Redis not available');
  }

  const PORT = process.env.PORT || 3001;
  httpServer.listen(PORT, () => {
    console.log(`🚀 FlashChat server running on port ${PORT}`);
    console.log(`📱 API endpoint: http://localhost:${PORT}`);
    console.log(`🔑 Login API: POST http://localhost:${PORT}/api/v1/users/login`);
    console.log(`📝 Register API: POST http://localhost:${PORT}/api/v1/users/register`);
    console.log(`👥 Groups API: GET http://localhost:${PORT}/api/v1/groups`);
  });
}

// 启动服务器
start();
