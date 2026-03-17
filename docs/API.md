# 快闪群聊App - API文档

## 基础信息

- **Base URL**: `http://localhost:3000/api/v1`
- **WebSocket**: `ws://localhost:3000`
- **认证方式**: Bearer Token

## 认证

### 登录

```http
POST /users/login
Content-Type: application/json

{
  "phone": "13800138000",
  "code": "1234"
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "user": {
      "id": "user_13800138",
      "nickname": "用户3800",
      "createdAt": 1710605800000,
      "updatedAt": 1710605800000
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 获取当前用户

```http
GET /users/me
Authorization: Bearer {token}
```

## 群组API

### 获取首页群组列表

```http
GET /groups
```

响应：
```json
{
  "code": 0,
  "data": [
    {
      "id": "system_hiking",
      "name": "徒步",
      "type": "system",
      "memberCount": 12,
      "maxMembers": 20,
      "heatLevel": "high",
      "heatColor": "#F5A623",
      "isSystem": true,
      "createdAt": 1710605800000
    }
  ]
}
```

### 获取群组详情

```http
GET /groups/{groupId}
```

### 创建群组

```http
POST /groups
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "我的群聊",
  "type": "user_created"
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "groupId": "group_1710605800000_abc123"
  }
}
```

错误响应：
```json
{
  "code": 3004,
  "error": 3004,
  "message": "您已有创建的群，可解散后重新创建"
}
```

### 解散群组

```http
DELETE /groups/{groupId}
Authorization: Bearer {token}
```

### 获取解散冷却状态

```http
GET /groups/my/cooldown
Authorization: Bearer {token}
```

响应：
```json
{
  "code": 0,
  "data": {
    "userId": "user_123",
    "dissolvedAt": 1710605800000,
    "expiresAt": 1710620200000,
    "remainingSeconds": 14400
  }
}
```

## 消息API

### 获取群组消息

```http
GET /groups/{groupId}/messages
```

响应：
```json
{
  "code": 0,
  "data": [
    {
      "id": "msg_1710605800000_xyz789",
      "groupId": "group_123",
      "sender": {
        "id": "user_123",
        "name": "用户123",
        "type": "user"
      },
      "content": "消息内容",
      "type": "text",
      "isTruncated": false,
      "deleted": false,
      "createdAt": 1710605800000
    }
  ]
}
```

### 发送消息（REST备用）

```http
POST /groups/{groupId}/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "消息内容",
  "type": "text"
}
```

### 删除消息

```http
DELETE /groups/{groupId}/messages/{msgId}
Authorization: Bearer {token}
```

### 校验消息长度

```http
POST /messages/validate
Content-Type: application/json

{
  "content": "消息内容"
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "valid": true,
    "length": 4,
    "maxLength": 50,
    "displayMode": "full"
  }
}
```

## 弹幕API

### 获取最近弹幕

```http
GET /danmaku
```

响应：
```json
{
  "code": 0,
  "data": [
    {
      "id": "danmaku_1710605800000_abc123",
      "content": "弹幕内容",
      "senderName": "用户123",
      "track": 3,
      "duration": 8000,
      "createdAt": 1710605800000
    }
  ]
}
```

### 发送弹幕（REST备用）

```http
POST /danmaku
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "弹幕内容"
}
```

## WebSocket事件

### 客户端事件（发送）

#### 加入首页

```json
{
  "event": "join_home",
  "data": {
    "userId": "user_123"
  }
}
```

#### 离开首页

```json
{
  "event": "leave_home"
}
```

#### 加入群组

```json
{
  "event": "join_group",
  "data": {
    "groupId": "group_123"
  }
}
```

#### 离开群组

```json
{
  "event": "leave_group",
  "data": {
    "groupId": "group_123"
  }
}
```

#### 发送消息

```json
{
  "event": "send_message",
  "data": {
    "groupId": "group_123",
    "content": "消息内容",
    "type": "text"
  }
}
```

#### 发送弹幕

```json
{
  "event": "send_danmaku",
  "data": {
    "content": "弹幕内容"
  }
}
```

#### 删除消息

```json
{
  "event": "delete_message",
  "data": {
    "msgId": "msg_123",
    "groupId": "group_123"
  }
}
```

#### 心跳

```json
{
  "event": "ping"
}
```

### 服务端事件（接收）

#### 首页初始化

```json
{
  "event": "home_init",
  "data": {
    "groups": [...],
    "danmakuHistory": [...]
  }
}
```

#### 群组消息

```json
{
  "event": "group_message",
  "data": {
    "id": "msg_123",
    "groupId": "group_123",
    "sender": {...},
    "content": "消息内容",
    "isSelf": true,
    "createdAt": 1710605800000
  }
}
```

#### 热度更新

```json
{
  "event": "heat_update",
  "data": {
    "groupId": "group_123",
    "level": "high",
    "color": "#F5A623",
    "msgPerMin": 15
  }
}
```

#### 弹幕

```json
{
  "event": "danmaku",
  "data": {
    "id": "danmaku_123",
    "content": "弹幕内容",
    "senderName": "用户123",
    "track": 3,
    "duration": 8000
  }
}
```

#### 强制离开（解散群时）

```json
{
  "event": "force_leave",
  "data": {
    "groupId": "group_123",
    "reason": "group_dissolved",
    "redirectTo": "home",
    "silent": true
  }
}
```

#### 消息移除

```json
{
  "event": "message_removed",
  "data": {
    "msgId": "msg_123",
    "silent": true
  }
}
```

#### 心跳响应

```json
{
  "event": "pong",
  "data": {
    "timestamp": 1710605800000
  }
}
```

#### 错误

```json
{
  "event": "error",
  "data": {
    "code": 3002,
    "message": "群组已满员"
  }
}
```

## 错误码

| 错误码 | 描述 |
|--------|------|
| 0 | 成功 |
| 1000 | 未知错误 |
| 1001 | 参数错误 |
| 1002 | 未授权 |
| 1003 | 禁止访问 |
| 1004 | 资源不存在 |
| 2000 | 用户不存在 |
| 2001 | 用户已存在 |
| 3000 | 群组不存在 |
| 3001 | 群组已存在 |
| 3002 | 群组已满员 |
| 3003 | 解散冷却中 |
| 3004 | 已拥有群组 |
| 3005 | 不是群主 |
| 4000 | 消息过长 |
| 4001 | 消息包含敏感词 |
| 4002 | 发送过于频繁 |
| 5000 | 连接数超限 |

## 限流规则

- **API请求**: 每分钟100次
- **消息发送**: 每分钟10条
- **WebSocket连接**: 每个用户最多2个

---

**版本**: v1.0.0  
**最后更新**: 2026-03-17
