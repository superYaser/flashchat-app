/**
 * ============================================================================
 * 快闪群聊App - 共享类型定义
 * ============================================================================
 * 此文件包含前后端共享的所有类型定义
 * 用于确保类型一致性，避免前后端类型不匹配
 * ============================================================================
 */

// =============================================================================
// 基础类型
// =============================================================================

/** 用户ID */
export type UserId = string;

/** 群组ID */
export type GroupId = string;

/** 消息ID */
export type MessageId = string;

/** 时间戳（Unix毫秒） */
export type Timestamp = number;

// =============================================================================
// 用户相关类型
// =============================================================================

/** 用户基础信息 */
export interface User {
  id: UserId;
  nickname: string;
  avatar?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 用户会话信息 */
export interface UserSession {
  userId: UserId;
  token: string;
  expiresAt: Timestamp;
}

/** 用户群关系 */
export interface UserGroupRelation {
  userId: UserId;
  groupId: GroupId;
  role: 'owner' | 'member';
  joinedAt: Timestamp;
}

// =============================================================================
// 群组相关类型
// =============================================================================

/** 热度等级 */
export type HeatLevel = 'low' | 'medium' | 'high' | 'extreme';

/** 热度等级配置 */
export interface HeatLevelConfig {
  level: HeatLevel;
  color: string;           // 边框颜色
  gradient: [string, string]; // 渐变色 [start, end]
  frequency: number;       // 呼吸频率（秒/次）
  scale?: number;          // 脉动缩放比例（仅extreme）
}

/** 热度等级配置映射 */
export const HEAT_LEVEL_CONFIG: Record<HeatLevel, HeatLevelConfig> = {
  low: {
    level: 'low',
    color: '#999999',
    gradient: ['#999999', '#CCCCCC'],
    frequency: 0, // 无呼吸效果
  },
  medium: {
    level: 'medium',
    color: '#4A90E2',
    gradient: ['#4A90E2', '#7BB7F0'],
    frequency: 3.0,
  },
  high: {
    level: 'high',
    color: '#F5A623',
    gradient: ['#F5A623', '#F8E71C'],
    frequency: 1.5,
  },
  extreme: {
    level: 'extreme',
    color: '#D0021B',
    gradient: ['#D0021B', '#FF6B6B'],
    frequency: 0.8,
    scale: 1.05,
  },
};

/** 热度阈值配置 */
export const HEAT_THRESHOLDS = {
  medium: 3,   // 3条/分钟
  high: 10,    // 10条/分钟
  extreme: 30, // 30条/分钟
};

/** 群组类型 */
export type GroupType = 'system' | 'user_created';

/** 系统群类型 */
export type SystemGroupType = 'hiking' | 'fishing' | 'stock' | 'mahjong' | 'parenting';

/** 系统群配置 */
export interface SystemGroupConfig {
  id: SystemGroupType;
  name: string;
  keyword: string;
  interval: number; // 机器人推送间隔（秒）
}

/** 系统群配置映射 */
export const SYSTEM_GROUPS: Record<SystemGroupType, SystemGroupConfig> = {
  hiking: {
    id: 'hiking',
    name: '徒步',
    keyword: '徒步 户外 登山',
    interval: 300, // 5分钟
  },
  fishing: {
    id: 'fishing',
    name: '钓鱼',
    keyword: '钓鱼 垂钓',
    interval: 420, // 7分钟
  },
  stock: {
    id: 'stock',
    name: '股票',
    keyword: '股票 股市 财经',
    interval: 300, // 5分钟
  },
  mahjong: {
    id: 'mahjong',
    name: '麻将',
    keyword: '麻将 棋牌',
    interval: 600, // 10分钟
  },
  parenting: {
    id: 'parenting',
    name: '辅导小孩',
    keyword: '亲子 教育 育儿',
    interval: 480, // 8分钟
  },
};

/** 群组基础信息 */
export interface Group {
  id: GroupId;
  name: string;
  type: GroupType;
  ownerId?: UserId;        // 用户群才有群主
  memberCount: number;
  maxMembers: number;      // 固定20人
  heatLevel: HeatLevel;
  heatColor: string;
  isSystem: boolean;
  createdAt: Timestamp;
  lastMessageAt?: Timestamp;
  position?: Position;     // 首页游走位置
}

/** 首页游走位置 */
export interface Position {
  x: number;
  y: number;
}

/** 群解散冷却信息 */
export interface DissolveCooldown {
  userId: UserId;
  dissolvedAt: Timestamp;
  expiresAt: Timestamp;
  remainingSeconds: number;
}

// =============================================================================
// 消息相关类型
// =============================================================================

/** 消息类型 */
export type MessageType = 'text' | 'system';

/** 消息发送者 */
export interface MessageSender {
  id: UserId;
  name: string;
  avatar?: string;
  type: 'user' | 'system';
}

/** 消息基础结构 */
export interface Message {
  id: MessageId;
  groupId: GroupId;
  sender: MessageSender;
  content: string;
  type: MessageType;
  isTruncated: boolean;    // 是否被截断
  summary?: string;        // 摘要（超过24字时生成）
  fullContent?: string;    // 完整内容（仅截断时返回）
  deleted: boolean;        // 是否被删除
  createdAt: Timestamp;
}

/** 消息显示模式 */
export type DisplayMode = 'full' | 'summary';

/** 消息长度校验结果 */
export interface MessageLengthCheck {
  valid: boolean;
  length: number;
  maxLength: number;
  displayMode: DisplayMode;
  summary?: string;
  fullContent?: string;
  error?: string;
}

// =============================================================================
// 弹幕相关类型
// =============================================================================

/** 弹幕消息 */
export interface Danmaku {
  id: string;
  senderId: string;        // 发送者ID
  senderName: string;      // 发送者名称
  content: string;
  track: number;           // 轨道编号
  duration: number;        // 滚动时长（毫秒）
  createdAt: Timestamp;
}

/** 弹幕轨道配置 */
export interface DanmakuTrack {
  index: number;
  y: number;               // 轨道Y坐标
  occupied: boolean;       // 是否被占用
  occupiedUntil: Timestamp;
}

// =============================================================================
// WebSocket 事件类型
// =============================================================================

/** WebSocket 客户端事件 */
export type ClientEvent =
  | 'join_home'
  | 'leave_home'
  | 'join_group'
  | 'leave_group'
  | 'send_message'
  | 'send_danmaku'
  | 'delete_message'
  | 'ping';

/** WebSocket 服务端事件 */
export type ServerEvent =
  | 'home_init'
  | 'group_message'
  | 'danmaku'
  | 'heat_update'
  | 'force_leave'
  | 'message_removed'
  | 'error'
  | 'pong';

/** WebSocket 事件负载 */
export interface WebSocketPayload<T = unknown> {
  event: ClientEvent | ServerEvent;
  data: T;
  timestamp: Timestamp;
}

/** 加入首页请求 */
export interface JoinHomeRequest {
  userId: UserId;
}

/** 首页初始化响应 */
export interface HomeInitResponse {
  groups: Group[];
  danmakuHistory: Danmaku[];
}

/** 发送消息请求 */
export interface SendMessageRequest {
  groupId: GroupId;
  content: string;
  type: MessageType;
}

/** 发送弹幕请求 */
export interface SendDanmakuRequest {
  content: string;
}

/** 热度更新事件 */
export interface HeatUpdateEvent {
  groupId: GroupId;
  level: HeatLevel;
  color: string;
  msgPerMin: number;
}

/** 强制离开事件 */
export interface ForceLeaveEvent {
  groupId: GroupId;
  reason: 'group_dissolved' | 'kicked';
  redirectTo: 'home';
  silent: boolean;
}

/** 消息移除事件 */
export interface MessageRemovedEvent {
  msgId: MessageId;
  silent: boolean;
}

// =============================================================================
// API 请求/响应类型
// =============================================================================

/** API 通用响应 */
export interface ApiResponse<T = unknown> {
  code: number;
  data?: T;
  error?: string;
  message?: string;
}

/** 创建群组请求 */
export interface CreateGroupRequest {
  name: string;
  type: 'user_created';
}

/** 创建群组响应 */
export interface CreateGroupResponse {
  groupId: GroupId;
  inviteLink?: string;
}

/** 获取消息列表响应 */
export interface GetMessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

// =============================================================================
// 常量定义
// =============================================================================

/** 业务常量 */
export const CONSTANTS = {
  // 群聊限制
  MAX_GROUP_MEMBERS: 20,
  MAX_USER_OWNED_GROUPS: 1,
  
  // 消息限制
  MAX_MESSAGE_LENGTH: 50,      // 最大50字符
  SUMMARY_THRESHOLD: 24,       // 超过24字生成摘要
  MAX_LINE_LENGTH: 12,         // 每行12字符
  MAX_DISPLAY_LINES: 2,        // 默认显示2行
  
  // 弹幕限制
  MAX_DANMAKU_LENGTH: 24,
  DANMAKU_TTL_SECONDS: 180,    // 3分钟
  
  // 消息保留时间
  MESSAGE_TTL_SECONDS: 300,    // 5分钟
  
  // 解散冷却
  DISSOLVE_COOLDOWN_SECONDS: 14400, // 4小时
  
  // 热度计算
  HEAT_WINDOW_SECONDS: 60,     // 1分钟窗口
  HEAT_CALC_INTERVAL: 10000,   // 10秒计算一次
  
  // WebSocket
  HEARTBEAT_INTERVAL: 30000,   // 30秒心跳
  RECONNECT_BASE_DELAY: 1000,  // 1秒基础重连延迟
  RECONNECT_MAX_DELAY: 30000,  // 最大30秒重连延迟
  
  // 防刷限制
  MAX_MESSAGES_PER_MINUTE: 10,
  MAX_WS_CONNECTIONS_PER_USER: 2,
} as const;

// =============================================================================
// 错误码定义
// =============================================================================

/** API 错误码 */
export enum ErrorCode {
  // 成功
  SUCCESS = 0,
  
  // 通用错误
  UNKNOWN_ERROR = 1000,
  INVALID_PARAMS = 1001,
  UNAUTHORIZED = 1002,
  FORBIDDEN = 1003,
  NOT_FOUND = 1004,
  
  // 用户相关
  USER_NOT_FOUND = 2000,
  USER_ALREADY_EXISTS = 2001,
  
  // 群组相关
  GROUP_NOT_FOUND = 3000,
  GROUP_ALREADY_EXISTS = 3001,
  GROUP_FULL = 3002,
  COOLDOWN_ACTIVE = 3003,
  ALREADY_OWN_GROUP = 3004,
  NOT_GROUP_OWNER = 3005,
  
  // 消息相关
  MESSAGE_TOO_LONG = 4000,
  MESSAGE_CONTAINS_SENSITIVE_WORDS = 4001,
  RATE_LIMITED = 4002,
  
  // WebSocket相关
  WS_CONNECTION_LIMIT = 5000,
}

/** 错误码映射 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.SUCCESS]: '成功',
  [ErrorCode.UNKNOWN_ERROR]: '未知错误',
  [ErrorCode.INVALID_PARAMS]: '参数错误',
  [ErrorCode.UNAUTHORIZED]: '未授权',
  [ErrorCode.FORBIDDEN]: '禁止访问',
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.USER_ALREADY_EXISTS]: '用户已存在',
  [ErrorCode.GROUP_NOT_FOUND]: '群组不存在',
  [ErrorCode.GROUP_ALREADY_EXISTS]: '群组已存在',
  [ErrorCode.GROUP_FULL]: '群组已满员',
  [ErrorCode.COOLDOWN_ACTIVE]: '解散冷却中',
  [ErrorCode.ALREADY_OWN_GROUP]: '您已有创建的群',
  [ErrorCode.NOT_GROUP_OWNER]: '不是群主',
  [ErrorCode.MESSAGE_TOO_LONG]: '消息过长',
  [ErrorCode.MESSAGE_CONTAINS_SENSITIVE_WORDS]: '消息包含敏感词',
  [ErrorCode.RATE_LIMITED]: '发送过于频繁',
  [ErrorCode.WS_CONNECTION_LIMIT]: '连接数超限',
};

// =============================================================================
// 工具类型
// =============================================================================

/** 可空类型 */
export type Nullable<T> = T | null;

/** 可选类型 */
export type Optional<T> = T | undefined;

/** 分页请求 */
export interface PaginationRequest {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

/** 分页响应 */
export interface PaginationResponse<T> {
  list: T[];
  total?: number;
  hasMore: boolean;
  nextCursor?: string;
}
