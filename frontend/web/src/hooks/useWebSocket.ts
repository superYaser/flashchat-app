/**
 * ============================================================================
 * 快闪群聊App - WebSocket Hook
 * ============================================================================
 */

import { useEffect, useCallback, useRef } from 'react';
import { useWebSocketStore } from '../stores/websocketStore';
import { wsClient } from '../api/websocket';
import { useAuthStore } from '../stores/authStore';

export function useWebSocket() {
  const { token, user } = useAuthStore();
  const {
    connected,
    reconnecting,
    reconnectAttempts,
    connect,
    disconnect,
  } = useWebSocketStore();

  const initializedRef = useRef(false);

  // 初始化WebSocket连接
  useEffect(() => {
    if (token && user && !initializedRef.current) {
      initializedRef.current = true;
      wsClient.setToken(token);
      connect();
    }

    return () => {
      if (initializedRef.current) {
        disconnect();
        initializedRef.current = false;
      }
    };
  }, [token, user, connect, disconnect]);

  /**
   * 手动重连
   */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      connect();
    }, 1000);
  }, [connect, disconnect]);

  return {
    connected,
    reconnecting,
    reconnectAttempts,
    reconnect,
  };
}
