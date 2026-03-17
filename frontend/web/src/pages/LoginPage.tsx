/**
 * ============================================================================
 * 快闪群聊App - 登录/注册页
 * ============================================================================
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { userAPI } from '../api/client';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, setLoading, setError } = useAuthStore();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !password) {
      setErrorMsg('请输入用户名和密码');
      return;
    }

    if (name.length < 2) {
      setErrorMsg('用户名至少2个字符');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('密码至少6个字符');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const api = isRegister ? userAPI.register : userAPI.login;
      const response = await api(name, password);

      if (response.code === 0 && response.data) {
        login(response.data.user, response.data.token);
        navigate('/');
      } else {
        setErrorMsg(response.message || (isRegister ? '注册失败' : '登录失败'));
      }
    } catch (error) {
      setErrorMsg(isRegister ? '注册失败，请重试' : '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h2 className="login-title">{isRegister ? '注册账号' : '欢迎回来'}</h2>
        <p className="login-subtitle">
          {isRegister ? '注册后即可创建群聊' : '登录后即可创建群聊'}
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="name">用户名</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入用户名"
              maxLength={20}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              maxLength={20}
            />
          </div>

          {errorMsg && <div className="error-message">{errorMsg}</div>}

          <button
            type="submit"
            className="login-btn"
            disabled={isLoading}
          >
            {isLoading ? (isRegister ? '注册中...' : '登录中...') : (isRegister ? '注册' : '登录')}
          </button>
        </form>

        <div className="login-switch">
          {isRegister ? (
            <p>已有账号？<span onClick={() => setIsRegister(false)}>立即登录</span></p>
          ) : (
            <p>没有账号？<span onClick={() => setIsRegister(true)}>立即注册</span></p>
          )}
        </div>

        <div className="login-tips">
          <p>提示：用户名2-20字符，密码至少6字符</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
