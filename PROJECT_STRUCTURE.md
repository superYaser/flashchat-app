# 快闪群聊App - 项目结构说明

## 目录树

```
flashchat-app/
├── README.md                       # 项目主文档
├── PROJECT_STRUCTURE.md            # 本文件
│
├── shared/
│   └── types/
│       └── index.ts                # 前后端共享类型定义（600+行）
│                                   # 包含：User, Group, Message, Danmaku,
│                                   #       HeatLevel, ErrorCode, CONSTANTS等
│
├── backend/                        # Node.js后端服务
│   ├── .env.example                # 环境变量模板
│   ├── package.json                # 依赖配置
│   ├── tsconfig.json               # TypeScript配置
│   └── src/
│       ├── index.ts                # 服务入口（Express + Socket.IO）
│       ├── config/
│       │   └── index.ts            # 全局配置（Redis, MongoDB, JWT等）
│       ├── gateway/
│       │   └── websocket.gateway.ts # WebSocket网关（连接管理、事件路由）
│       ├── services/
│       │   ├── user/
│       │   │   └── routes.ts       # 用户API路由
│       │   ├── group/
│       │   │   ├── group.service.ts # 群组服务（CRUD、热度、冷却）
│       │   │   └── routes.ts       # 群组API路由
│       │   ├── message/
│       │   │   ├── message.service.ts # 消息服务（Emoji计算、敏感词过滤）
│       │   │   └── routes.ts       # 消息API路由
│       │   └── danmaku/
│       │       ├── danmaku.service.ts # 弹幕服务（轨道管理）
│       │       └── routes.ts       # 弹幕API路由
│       ├── scheduler/
│       │   ├── bot.scheduler.ts    # 机器人定时任务（内容去重）
│       │   └── heat.calculator.ts  # 热度计算器（每10秒广播）
│       ├── middleware/
│       │   ├── auth.ts             # JWT认证中间件
│       │   ├── errorHandler.ts     # 全局错误处理
│       │   ├── requestLogger.ts    # 请求日志
│       │   ├── rateLimiter.ts      # 限流中间件
│       │   └── validateRequest.ts  # 请求验证
│       └── utils/
│           ├── redis.ts            # Redis客户端封装
│           ├── mongo.ts            # MongoDB客户端封装
│           └── logger.ts           # Winston日志工具
│
├── frontend/web/                   # React Web客户端
│   ├── .env.example                # 环境变量模板
│   ├── package.json                # 依赖配置
│   ├── tsconfig.json               # TypeScript配置
│   ├── tsconfig.node.json          # Node类型配置
│   ├── vite.config.ts              # Vite配置
│   ├── index.html                  # HTML入口
│   └── src/
│       ├── main.tsx                # React入口
│       ├── App.tsx                 # 主应用组件
│       ├── index.css               # 全局样式
│       ├── types/
│       │   └── index.ts            # 前端类型定义（扩展共享类型）
│       ├── api/
│       │   ├── client.ts           # HTTP API客户端
│       │   └── websocket.ts        # WebSocket客户端封装
│       ├── stores/
│       │   ├── authStore.ts        # 认证状态（Zustand）
│       │   └── websocketStore.ts   # WebSocket状态
│       ├── components/
│       │   ├── Layout.tsx          # 布局组件
│       │   └── Layout.css          # 布局样式
│       └── pages/
│           ├── HomePage.tsx        # 首页（广场）
│           ├── HomePage.css        # 首页样式
│           ├── ChatPage.tsx        # 群聊页
│           ├── ChatPage.css        # 群聊样式
│           ├── LoginPage.tsx       # 登录页
│           ├── LoginPage.css       # 登录样式
│           ├── CreateGroupPage.tsx # 创建群组页
│           └── CreateGroupPage.css # 创建群组样式
│
└── docs/
    └── AI_PROGRAMMING_GUIDE.md     # AI编程指南
```

## 核心文件说明

### 1. 共享类型 (`shared/types/index.ts`)

这是最重要的文件，定义了前后端共享的所有类型：

- **基础类型**: `UserId`, `GroupId`, `MessageId`, `Timestamp`
- **用户相关**: `User`, `UserSession`, `UserGroupRelation`
- **群组相关**: `Group`, `GroupType`, `HeatLevel`, `HeatLevelConfig`
- **消息相关**: `Message`, `MessageType`, `MessageLengthCheck`
- **弹幕相关**: `Danmaku`, `DanmakuTrack`
- **WebSocket事件**: `ClientEvent`, `ServerEvent`, 各种事件数据类型
- **常量**: `CONSTANTS` (消息限制、TTL、心跳间隔等)
- **错误码**: `ErrorCode`, `ERROR_MESSAGES`

### 2. 后端入口 (`backend/src/index.ts`)

应用主类 `FlashChatApplication`：
- 初始化Express应用
- 配置中间件（CORS、Helmet、压缩、限流）
- 配置API路由
- 初始化WebSocket网关
- 启动定时任务（机器人、热度计算）
- 优雅关闭处理

### 3. WebSocket网关 (`backend/src/gateway/websocket.gateway.ts`)

核心功能：
- 连接管理（限制每个用户最多2个连接）
- 房间管理（首页房间、群组房间）
- 事件路由（`join_home`, `send_message`, `send_danmaku`等）
- 广播方法（`broadcastHeatUpdate`, `forceLeaveGroup`）

### 4. 群组服务 (`backend/src/services/group/group.service.ts`)

主要方法：
- `getHomeGroups()` - 获取首页群组列表
- `createGroup()` - 创建群组（检查冷却、检查已拥有）
- `dissolveGroup()` - 解散群组（设置冷却、清理数据）
- `calculateHeatLevel()` - 计算热度等级
- `getDissolveCooldown()` - 获取解散冷却信息

### 5. 消息服务 (`backend/src/services/message/message.service.ts`)

核心功能：
- `createMessage()` - 创建消息（敏感词过滤）
- `checkMessageLength()` - 长度校验（Intl.Segmenter标准）
- `calculateLengthWithEmoji()` - Emoji算2字符
- `generateSummary()` - 生成摘要（前24字 + ...）

### 6. 前端WebSocket客户端 (`frontend/web/src/api/websocket.ts`)

封装Socket.IO客户端：
- 连接管理（自动重连、指数退避）
- 事件订阅/取消订阅
- 发送事件（`joinHome`, `sendMessage`, `sendDanmaku`等）
- 状态查询（`isConnected`, `getReconnectAttempts`）

## 关键技术点

### 1. Emoji长度计算

```typescript
const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });

function calculateLength(text: string): number {
  const segments = Array.from(segmenter.segment(text));
  let length = 0;
  for (const { segment } of segments) {
    if (/\p{Emoji_Presentation}/u.test(segment)) {
      length += 2;  // Emoji占2字符
    } else {
      length += 1;  // 普通字符占1字符
    }
  }
  return length;
}
```

### 2. 热度计算

```typescript
// 每分钟消息数
const msgPerMin = await redis.get(`group:heat:${groupId}:${currentMin}`);

// 热度等级
if (msgPerMin >= 30) return 'extreme';
if (msgPerMin >= 10) return 'high';
if (msgPerMin >= 3) return 'medium';
return 'low';
```

### 3. Redis Key命名规范

```
group:msg:{group_id}              # Sorted Set - 群消息
group:room:{group_id}             # Hash - 群信息
group:heat:{group_id}:{min}       # String - 热度计数
group:members:{group_id}          # Set - 群成员
group:dissolved:{group_id}        # String - 解散标记

danmaku:home_page                 # List - 弹幕

user:groups:{user_id}             # Set - 用户加入的群
user:owned:{user_id}              # String - 用户创建的群
user:dissolve:cooldown:{user_id}  # String with TTL - 解散冷却

bot:history:{group_type}          # ZSET - 机器人内容去重
```

## 快速开始

```bash
# 1. 安装后端依赖
cd backend
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 3. 启动后端（开发模式）
npm run dev

# 4. 安装前端依赖
cd ../frontend/web
npm install

# 5. 配置环境变量
cp .env.example .env

# 6. 启动前端
npm run dev

# 7. 访问 http://localhost:3001
```

## 开发规范

1. **类型定义**: 所有类型必须在 `shared/types/index.ts` 中定义
2. **Redis Key**: 使用冒号分隔的层级结构
3. **错误处理**: 使用统一的 `ErrorCode` 错误码
4. **日志记录**: 使用 `logger` 工具类
5. **注释规范**: 文件头部添加功能说明注释

---

**版本**: v1.0.0  
**最后更新**: 2026-03-17
