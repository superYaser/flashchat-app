/**
 * 快闪群聊App - 完整修复版后端
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Redis = require('ioredis');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'flashchat-secret-key-2024';

// Redis客户端
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

// MongoDB客户端
let db;
let usersCollection;
let groupsCollection;
let messagesCollection;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flashchat';

// 内存存储（当MongoDB不可用时使用）
const memoryUsers = new Map();
const memoryGroups = new Map();
const memoryMessages = new Map();

// 中间件
app.use(cors());
app.use(express.json());

// ======== 5个系统群定义 ========
const SYSTEM_GROUPS = [
  { id: 'system_hiking', name: '徒步', type: 'system', memberCount: 12, maxMembers: 20, heatLevel: 'medium', heatColor: '#4A90E2', isSystem: true, createdAt: Date.now() },
  { id: 'system_fishing', name: '钓鱼', type: 'system', memberCount: 8, maxMembers: 20, heatLevel: 'low', heatColor: '#999999', isSystem: true, createdAt: Date.now() },
  { id: 'system_stock', name: '股票', type: 'system', memberCount: 15, maxMembers: 20, heatLevel: 'high', heatColor: '#F5A623', isSystem: true, createdAt: Date.now() },
  { id: 'system_mahjong', name: '麻将', type: 'system', memberCount: 6, maxMembers: 20, heatLevel: 'low', heatColor: '#999999', isSystem: true, createdAt: Date.now() },
  { id: 'system_parenting', name: '辅导小孩', type: 'system', memberCount: 10, maxMembers: 20, heatLevel: 'medium', heatColor: '#4A90E2', isSystem: true, createdAt: Date.now() }
];

// ======== 健康检查 ========
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), version: '1.0.0' });
});

// ======== 用户注册API ========
app.post('/api/v1/users/register', async (req, res) => {
  try {
    const { name, password } = req.body;

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

// ======== 用户登录API ========
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

// ======== 获取当前用户信息API ========
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

// ======== 获取群组列表API ========
app.get('/api/v1/groups', async (req, res) => {
  try {
    // 返回5个固定系统群
    res.json({ code: 0, data: SYSTEM_GROUPS });
  } catch (error) {
    console.error('Get groups error:', error);
    res.json({ code: 500, message: '获取群组列表失败' });
  }
});

// ======== 获取单个群组详情API ========
app.get('/api/v1/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = SYSTEM_GROUPS.find(g => g.id === groupId);

    if (!group) {
      return res.json({ code: 404, message: '群组不存在' });
    }

    res.json({ code: 0, data: group });
  } catch (error) {
    console.error('Get group error:', error);
    res.json({ code: 500, message: '获取群组详情失败' });
  }
});

// ======== 获取群组成员API ========
app.get('/api/v1/groups/:groupId/members', async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = SYSTEM_GROUPS.find(g => g.id === groupId);

    if (!group) {
      return res.json({ code: 404, message: '群组不存在' });
    }

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

// ======== WebSocket连接处理 ========
const connectedUsers = new Map(); // socketId -> userInfo

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 发送欢迎消息
  socket.emit('connected', { socketId: socket.id, timestamp: Date.now() });

  // ====== 首页相关事件 ======
  socket.on('join_home', (data) => {
    console.log('User joined home:', socket.id);
    socket.join('home');

    // 发送首页初始化数据
    socket.emit('home_init', {
      groups: SYSTEM_GROUPS,
      danmakuHistory: []
    });
  });

  socket.on('leave_home', () => {
    socket.leave('home');
  });

  // ====== 弹幕相关事件 ======
  socket.on('send_danmaku', (data) => {
    console.log('Danmaku received:', data);

    const userInfo = connectedUsers.get(socket.id);
    const senderName = userInfo ? userInfo.name : (data.senderName || '匿名用户');

    const danmaku = {
      id: `danmaku_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      content: data.content,
      senderName: senderName,
      track: Math.floor(Math.random() * 5), // 5条轨道
      duration: 8000 + Math.random() * 4000, // 8-12秒
      createdAt: Date.now()
    };

    // 广播给所有在首页的用户
    io.to('home').emit('danmaku', danmaku);
    console.log('Danmaku broadcasted:', danmaku);
  });

  // ====== 群组相关事件 ======
  socket.on('join_group', (data) => {
    const { groupId, token } = data;
    console.log('User joined group:', groupId, socket.id);

    const room = `group:${groupId}`;
    socket.join(room);

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
    const group = SYSTEM_GROUPS.find(g => g.id === groupId) || { id: groupId, name: '未知群组', memberCount: 1 };

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

  socket.on('leave_group', (data) => {
    const { groupId } = data;
    const room = `group:${groupId}`;
    socket.leave(room);

    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      socket.to(room).emit('user_left', {
        userId: userInfo.id,
        name: userInfo.name,
        timestamp: Date.now()
      });
    }
  });

  // ====== 消息相关事件 ======
  socket.on('send_message', (data) => {
    const { groupId, content, type = 'text' } = data;
    const room = `group:${groupId}`;

    const userInfo = connectedUsers.get(socket.id) || { id: `guest_${socket.id}`, name: '游客', type: 'guest' };

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
    console.log('Message sent:', message);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    connectedUsers.delete(socket.id);
  });
});

// ======== 启动服务器 ========
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

start();
