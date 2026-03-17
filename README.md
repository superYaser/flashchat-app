# 快闪群聊App

> 轻量化、即时性、话题驱动的快闪式群聊工具

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.0+-black.svg)](https://socket.io/)

## 项目简介

快闪群聊App是一款创新的即时通讯应用，主打"快闪"概念：

- **零门槛参与**：无需加好友，点击即聊
- **热度可视化**：通过动态效果直观感受群聊活跃度
- **瞬时体验**：消息限时保存（5分钟），营造"在场感"

## 核心功能

### 首页（广场）
- 动态游走群聊卡片（带热度呼吸效果）
- 弹幕消息系统（3分钟可见）
- 快捷建群/修改群名

### 群聊房间
- 5分钟限时消息
- 12字×2行消息格式
- 摘要展开功能
- 群主静默删除

### 系统群
- 5个固定话题群（徒步、钓鱼、股票、麻将、辅导小孩）
- 自动机器人推送
- 内容去重机制

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│ 客户端层                                                    │
│ iOS App (Swift) / Android App (Kotlin) / Web (React)       │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS / WSS
┌──────────────────▼──────────────────────────────────────────┐
│ 接入层                                                      │
│ • API Gateway（限流、鉴权、路由）                          │
│ • Load Balancer（WebSocket长连接负载）                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 服务层                                                      │
│ User Svc │ Group Svc │ Message Svc │ Danmaku Svc            │
│ Heat Svc │ Bot Svc                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 数据层                                                      │
│ Redis Cluster（消息缓存、热度计算、在线状态）              │
│ MongoDB（用户数据、群元数据、历史归档）                    │
└─────────────────────────────────────────────────────────────┘
```

## 项目结构

```
flashchat-app/
├── shared/types/           # 前后端共享类型定义
├── backend/                # 后端服务 (Node.js + Express + Socket.IO)
├── frontend/web/           # Web客户端 (React + Vite)
├── docs/                   # 文档
├── docker-compose.yml      # Docker Compose配置
├── Dockerfile.backend      # 后端Dockerfile
├── Dockerfile.frontend     # 前端Dockerfile
├── nginx.conf              # Nginx配置
└── Makefile                # 常用命令
```

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
# 1. 克隆代码
git clone <repository-url>
cd flashchat-app

# 2. 启动服务
docker-compose up -d --build

# 3. 访问应用
# 前端: http://localhost
# 后端API: http://localhost:3000
```

### 方式二：手动部署

```bash
# 1. 安装依赖
make install

# 2. 启动数据库
docker-compose -f docker-compose.dev.yml up -d

# 3. 启动后端
cd backend && npm run dev

# 4. 启动前端（新终端）
cd frontend/web && npm run dev

# 5. 访问 http://localhost:3001
```

## 开发命令

```bash
# 安装所有依赖
make install

# 启动开发环境
make dev

# 构建生产版本
make build

# 运行测试
make test

# 代码检查
make lint

# 清理构建文件
make clean
```

## 核心技术点

### 1. Emoji长度计算（Intl.Segmenter标准）

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

### 2. 热度系统

| 等级 | 消息量 | 颜色 | 效果 |
|------|--------|------|------|
| low | < 3条/分钟 | 灰色 | 无 |
| medium | ≥ 3条/分钟 | 蓝色 | 3秒/次呼吸 |
| high | ≥ 10条/分钟 | 橙色 | 1.5秒/次呼吸 |
| extreme | ≥ 30条/分钟 | 红色 | 0.8秒/次 + 脉动 |

### 3. Redis Key命名规范

```
group:msg:{group_id}              # Sorted Set - 群消息
group:room:{group_id}             # Hash - 群信息
group:heat:{group_id}:{min}       # String - 热度计数
group:members:{group_id}          # Set - 群成员

danmaku:home_page                 # List - 弹幕

user:groups:{user_id}             # Set - 用户加入的群
user:owned:{user_id}              # String - 用户创建的群
user:dissolve:cooldown:{user_id}  # String with TTL - 解散冷却
```

## 文档

- [AI编程指南](./docs/AI_PROGRAMMING_GUIDE.md) - 开发规范和实现指南
- [API文档](./docs/API.md) - REST API和WebSocket事件
- [部署指南](./docs/DEPLOYMENT.md) - 生产环境部署说明
- [项目结构](./PROJECT_STRUCTURE.md) - 详细目录结构说明

## 开发规范

1. **类型定义**: 所有类型必须在 `shared/types/index.ts` 中定义
2. **Redis Key**: 使用冒号分隔的层级结构
3. **错误处理**: 使用统一的 `ErrorCode` 错误码
4. **日志记录**: 使用 `logger` 工具类，避免直接 `console.log`
5. **注释规范**: 文件头部添加功能说明注释

## 测试

```bash
# 运行所有测试
make test

# 运行测试（监听模式）
make test-watch

# 运行特定测试
cd backend && npm test -- message.service.test.ts
```

## 部署

详见 [部署指南](./docs/DEPLOYMENT.md)

```bash
# Docker部署
docker-compose up -d --build

# 手动部署
make build
pm2 start backend/dist/index.js --name flashchat-backend
```

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 技术栈

| 类别 | 技术 |
|------|------|
| 后端 | Node.js, Express, Socket.IO, TypeScript |
| 前端 | React, Vite, TypeScript, Zustand |
| 数据库 | Redis, MongoDB |
| 部署 | Docker, Docker Compose, Nginx |
| 测试 | Jest |

## 许可证

MIT License

---

**版本**: v1.0.0  
**最后更新**: 2026-03-17
