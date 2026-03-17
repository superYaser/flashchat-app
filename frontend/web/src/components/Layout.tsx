/**
 * ============================================================================
 * 快闪群聊App - 布局组件
 * ============================================================================
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import './Layout.css';

const Layout: React.FC = () => {
  return (
    <div className="layout">
      <header className="layout-header">
        <h1 className="layout-title">快闪群聊</h1>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
