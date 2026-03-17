/**
 * ============================================================================
 * 快闪群聊App - Toast通知组件
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        onClose?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast toast-${type} ${visible ? 'visible' : 'hidden'}`}>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={() => setVisible(false)}>
        ×
      </button>
    </div>
  );
};

// Toast管理器
interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 导出全局方法
  (window as any).showToast = addToast;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

// 便捷方法
export const toast = {
  success: (message: string) => (window as any).showToast?.(message, 'success'),
  error: (message: string) => (window as any).showToast?.(message, 'error'),
  warning: (message: string) => (window as any).showToast?.(message, 'warning'),
  info: (message: string) => (window as any).showToast?.(message, 'info'),
};
