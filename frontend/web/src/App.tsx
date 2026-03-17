/**
 * ============================================================================
 * 快闪群聊App - 主应用组件
 * ============================================================================
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useWebSocketStore } from './stores/websocketStore';
import { wsClient } from './api/websocket';

// 页面组件
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import CreateGroupPage from './pages/CreateGroupPage';

// 布局组件
import Layout from './components/Layout';

const App: React.FC = () => {
  const { isAuthenticated, token, user } = useAuthStore();
  const { connect, disconnect } = useWebSocketStore();

  // 初始化WebSocket连接 - 应用启动时就连接
  useEffect(() => {
    // 设置token（如果已登录）
    if (token) {
      wsClient.setToken(token);
    }

    // 连接WebSocket
    connect();

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="chat/:groupId" element={<ChatPage />} />
          <Route path="create-group" element={<CreateGroupPage />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
