# 快闪群聊App - AI编程指南

> 本文档为AI编程助手提供项目结构、开发规范和实现指导

## 目录

1. [项目概述](#项目概述)
2. [项目结构](#项目结构)
3. [核心概念](#核心概念)
4. [开发规范](#开发规范)
5. [实现指南](#实现指南)
6. [常见问题](#常见问题)

---

## 项目概述

### 产品定位
快闪群聊App是一款**轻量化、即时性、话题驱动**的快闪式群聊工具。

### 核心特性
- **零门槛参与**：无需加好友，点击即聊
- **热度可视化**：通过动态效果直观感受群聊活跃度
- **瞬时体验**：消息限时保存（5分钟），营造"在场感"

### 技术栈
| 层级 | 技术 |
|------|------|
| 客户端 | iOS (Swift) / Android (Kotlin) / Web (React) |
| 实时通信 | Socket.IO (WebSocket) |
| 缓存 | Redis (消息、热度、在线状态) |
| 持久化 | MongoDB (用户、群元数据) |
| 消息队列 | Kafka (可选，用于事件流) |

---

## 项目结构

```
flashchat-app/
├── shared/
│   └── types/              # 前后端共享类型定义
│       └── index.ts        # 所有类型、接口、常量
│
├── backend/                # 后端服务
│   ├── src/
│   │   ├── index.ts        # 服务入口
│   │   ├── config/         # 配置文件
│   │   ├── gateway/        # WebSocket网关
│   │   ├── services/       # 业务服务
│   │   │   ├── user/       # 用户服务
│   │   │   ├── group/      # 群组服务
│   │   │   ├── message/    # 消息服务
│   │   │   └── danmaku/    # 弹幕服务
│   │   ├── scheduler/      # 定时任务
│   │   │   ├── bot.scheduler.ts      # 机器人调度
│   │   │   └── heat.calculator.ts    # 热度计算
│   │   ├── middleware/     # 中间件
│   │   └── utils/          # 工具类
│   ├── .env.example        # 环境变量模板
│   └── package.json
│
├── frontend/               # 前端客户端
│   └── web/                # Web版本 (H5备用)
│       ├── src/
│       │   ├── types/      # 类型定义
│       │   ├── api/        # API客户端
│       │   │   ├── client.ts       # HTTP API
│       │   │   └── websocket.ts    # WebSocket
│       │   ├── components/ # 组件
│       │   ├── pages/      # 页面
│       │   ├── hooks/      # React Hooks
│       │   └── stores/     # 状态管理
│       └── .env.example
│
└── docs/                   # 文档
    ├── AI_PROGRAMMING_GUIDE.md   # 本文件
    ├── PRD.md                    # 产品需求文档
    └── TRD.md                    # 技术评审文档
```

---

## 核心概念

### 1. 群组 (Group)

#### 群组类型
- **系统群**：5个固定群（徒步、钓鱼、股票、麻将、辅导小孩）
- **用户群**：用户创建的群，一人最多创建一个

#### 热度系统
热度根据**最近1分钟消息量**计算：

| 等级 | 消息量 | 颜色 | 呼吸频率 |
|------|--------|------|----------|
| low | < 3条/分钟 | #999999 (灰) | 无 |
| medium | ≥ 3条/分钟 | #4A90E2 (蓝) | 3秒/次 |
| high | ≥ 10条/分钟 | #F5A623 (橙) | 1.5秒/次 |
| extreme | ≥ 30条/分钟 | #D0021B (红) | 0.8秒/次 + 脉动 |

### 2. 消息 (Message)

#### 消息结构
```typescript
interface Message {
  id: string;           // 消息ID
  groupId: string;      // 所属群组
  sender: MessageSender;
  content: string;      // 内容
  type: 'text' | 'system';
  isTruncated: boolean; // 是否被截断
  summary?: string;     // 摘要（超过24字时生成）
  fullContent?: string; // 完整内容
  deleted: boolean;     // 是否被删除
  createdAt: number;    // 时间戳
}
```

#### 长度限制
- 单行最多12个汉字
- 默认显示2行（24字）
- 超过24字生成摘要
- 最多50字（输入时限制）
- **Emoji算2字符**（使用Intl.Segmenter标准）

#### 保留时间
- 群聊消息：**5分钟**
- 弹幕消息：**3分钟**

### 3. 弹幕 (Danmaku)

#### 特性
- 仅首页用户可见
- 随机轨道，防重叠
- 滚动动画（8-15秒）

### 4. WebSocket 事件

#### 客户端事件 (Client -> Server)
| 事件 | 描述 |
|------|------|
| `join_home` | 加入首页 |
| `leave_home` | 离开首页 |
| `join_group` | 加入群组 |
| `leave_group` | 离开群组 |
| `send_message` | 发送消息 |
| `send_danmaku` | 发送弹幕 |
| `delete_message` | 删除消息 |
| `ping` | 心跳 |

#### 服务端事件 (Server -> Client)
| 事件 | 描述 |
|------|------|
| `home_init` | 首页初始化数据 |
| `group_message` | 新消息 |
| `heat_update` | 热度更新 |
| `danmaku` | 弹幕 |
| `force_leave` | 强制离开（解散群时） |
| `message_removed` | 消息被删除 |
| `pong` | 心跳响应 |

---

## 开发规范

### 1. 类型定义规范

所有类型定义必须在 `shared/types/index.ts` 中：

```typescript
// ✅ 正确：使用共享类型
import { Group, Message, UserId } from '../../../shared/types';

// ❌ 错误：重复定义类型
interface Group { ... }  // 不要这样做！
```

### 2. Emoji长度计算规范

必须使用 **Intl.Segmenter** 标准：

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

### 3. Redis Key 命名规范

使用冒号分隔的层级结构：

```
group:msg:{group_id}           # 群消息（Sorted Set）
group:room:{group_id}          # 群信息（Hash）
group:heat:{group_id}:{min}    # 热度计数（String）
group:members:{group_id}       # 群成员（Set）
group:dissolved:{group_id}     # 解散标记（String）

danmaku:{channel_id}           # 弹幕（List）

user:groups:{user_id}          # 用户加入的群（Set）
user:owned:{user_id}           # 用户创建的群（String）
user:dissolve:cooldown:{user_id}  # 解散冷却（String with TTL）

bot:history:{group_type}       # 机器人内容去重（ZSET）
```

### 4. 错误处理规范

使用统一的错误码：

```typescript
import { ErrorCode, ERROR_MESSAGES } from '../../../shared/types';

// 返回错误响应
res.status(400).json({
  code: ErrorCode.GROUP_FULL,
  error: ErrorCode.GROUP_FULL,
  message: ERROR_MESSAGES[ErrorCode.GROUP_FULL],
});
```

### 5. 日志规范

使用统一的logger：

```typescript
import { logger } from '../utils/logger';

logger.info('User created group', { userId, groupId });
logger.warn('Rate limit exceeded', { userId });
logger.error('Failed to send message', error);
```

---

## 实现指南

### 1. 添加新API接口

**步骤1**：在 `shared/types/index.ts` 中添加请求/响应类型

```typescript
export interface NewRequest { ... }
export interface NewResponse { ... }
```

**步骤2**：在 `backend/src/services/{service}/routes.ts` 中添加路由

```typescript
router.post('/new-endpoint', authMiddleware, async (req, res, next) => {
  try {
    const result = await service.newMethod(req.body);
    res.json({ code: ErrorCode.SUCCESS, data: result });
  } catch (error) {
    next(error);
  }
});
```

**步骤3**：在 `frontend/web/src/api/client.ts` 中添加API方法

```typescript
export const serviceAPI = {
  newMethod: (data: NewRequest) =>
    request<NewResponse>('/service/new-endpoint', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
```

### 2. 添加WebSocket事件

**步骤1**：在 `shared/types/index.ts` 中添加事件类型

```typescript
export type ClientEvent = ... | 'new_event';
export type ServerEvent = ... | 'new_event';

export interface NewEventData { ... }
```

**步骤2**：在 `backend/src/gateway/websocket.gateway.ts` 中添加处理器

```typescript
socket.on('new_event', async (data: NewEventData) => {
  await this.handleNewEvent(socket, data);
});
```

**步骤3**：在 `frontend/web/src/api/websocket.ts` 中添加事件处理

```typescript
this.socket.on('new_event', (data: NewEventData) => {
  this.emit('new_event', data);
});

public newEvent(data: NewEventData): void {
  this.socket?.emit('new_event', data);
}
```

### 3. 实现热度动画

**CSS动画示例**：

```css
@keyframes breathe {
  0%, 100% {
    box-shadow: 0 0 0 0 var(--heat-color);
  }
  50% {
    box-shadow: 0 0 10px 2px var(--heat-color);
  }
}

.group-card {
  animation: breathe var(--frequency) ease-in-out infinite;
}

.group-card.extreme {
  animation: breathe 0.8s ease-in-out infinite, pulse 0.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

### 4. 实现弹幕轨道管理

```typescript
class DanmakuTrackManager {
  private tracks: boolean[] = new Array(10).fill(false);
  
  allocateTrack(): number {
    const available = this.tracks.findIndex(occupied => !occupied);
    if (available !== -1) {
      this.tracks[available] = true;
      setTimeout(() => {
        this.tracks[available] = false;
      }, 8000); // 8秒后释放
    }
    return available;
  }
}
```

---

## 常见问题

### Q1: 如何处理Emoji长度计算？

**A**: 必须使用 `Intl.Segmenter` 标准，这是ECMAScript 2022的API，可以准确识别字形簇。

### Q2: 消息被截断后如何显示？

**A**: 
- 未展开：显示摘要（前24字 + ...）
- 点击展开：显示完整内容（最多50字）
- 展开状态保存在前端，切换页面后重置

### Q3: 群解散后如何处理在线用户？

**A**:
1. 服务端发送 `force_leave` 事件
2. 客户端静默处理，不显示任何提示
3. 自动返回首页，群卡片消失
4. 离线用户下次打开App时群已消失

### Q4: 如何防止消息重复发送？

**A**:
- 前端：发送按钮置灰，直到收到确认
- 后端：消息ID去重（基于时间戳+随机数）
- 网络错误：前端提示重发，不自动重试

### Q5: 热度计算频率？

**A**:
- 计算频率：每10秒计算一次
- 广播频率：热度变化时才广播
- 计数窗口：最近1分钟

---

## 参考文档

- [PRD - 产品需求文档](./PRD.md)
- [TRD - 技术评审文档](./TRD.md)
- [共享类型定义](../shared/types/index.ts)

---

**最后更新**: 2026-03-17
