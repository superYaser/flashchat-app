/**
 * ============================================================================
 * 快闪群聊App - Web前端类型定义
 * ============================================================================
 * 扩展共享类型，添加前端特有的类型定义
 * ============================================================================
 */

import {
  User,
  Group,
  Message,
  Danmaku,
  HeatLevel,
  HeatLevelConfig,
  HeatUpdateEvent,
  ForceLeaveEvent,
  MessageRemovedEvent,
  WebSocketPayload,
  ClientEvent,
  ServerEvent,
} from '../../../../shared/types';

export * from '../../../../shared/types';

// =============================================================================
// 组件Props类型
// =============================================================================

/** 群组卡片Props */
export interface GroupCardProps {
  group: Group;
  isOwnGroup: boolean;
  onClick: (group: Group) => void;
  style?: React.CSSProperties;
}

/** 消息气泡Props */
export interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
  onLongPress?: (message: Message) => void;
}

/** 弹幕Props */
export interface DanmakuItemProps {
  danmaku: Danmaku;
  onComplete?: () => void;
}

/** 输入框Props */
export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  maxLength: number;
  placeholder?: string;
  disabled?: boolean;
}

// =============================================================================
// 状态管理类型
// =============================================================================

/** 应用状态 */
export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isConnecting: boolean;
  connectionError: string | null;
}

/** 首页状态 */
export interface HomeState {
  groups: Group[];
  danmakuList: Danmaku[];
  isLoading: boolean;
}

/** 群聊状态 */
export interface ChatState {
  currentGroup: Group | null;
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
}

/** WebSocket状态 */
export interface WebSocketState {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  lastPingAt: number | null;
}

// =============================================================================
// 动画类型
// =============================================================================

/** 呼吸动画配置 */
export interface BreatheAnimationConfig {
  level: HeatLevel;
  colors: [string, string];
  frequency: number;
  scale?: number;
}

/** 游走动画配置 */
export interface WanderAnimationConfig {
  startX: number;
  startY: number;
  speed: number;
  direction: 'left' | 'right' | 'up' | 'down';
}

/** 弹幕动画配置 */
export interface DanmakuAnimationConfig {
  duration: number;
  track: number;
  delay: number;
}

// =============================================================================
// 事件处理类型
// =============================================================================

/** 消息事件处理器 */
export type MessageEventHandler = (message: Message) => void;

/** 热度更新事件处理器 */
export type HeatUpdateEventHandler = (event: HeatUpdateEvent) => void;

/** 弹幕事件处理器 */
export type DanmakuEventHandler = (danmaku: Danmaku) => void;

/** 强制离开事件处理器 */
export type ForceLeaveEventHandler = (event: ForceLeaveEvent) => void;

// =============================================================================
// API响应类型
// =============================================================================

/** API错误响应 */
export interface APIError {
  code: number;
  message: string;
  error?: string;
}

/** 分页请求参数 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

// =============================================================================
// 工具类型
// =============================================================================

/** React组件通用Props */
export interface CommonProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** 异步操作状态 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}
