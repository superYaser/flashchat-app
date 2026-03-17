/**
 * ============================================================================
 * 快闪群聊App - 创建群组页
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { groupAPI } from '../api/client';
import './CreateGroupPage.css';

const CreateGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldownInfo, setCooldownInfo] = useState<string | null>(null);

  // 检查解散冷却状态
  useEffect(() => {
    const checkCooldown = async () => {
      try {
        const response = await groupAPI.getCooldownStatus();
        if (response.data && response.data.remainingSeconds > 0) {
          const hours = Math.floor(response.data.remainingSeconds / 3600);
          const minutes = Math.floor((response.data.remainingSeconds % 3600) / 60);
          setCooldownInfo(`解散冷却中，剩余 ${hours}小时${minutes}分`);
        }
      } catch (error) {
        // 忽略错误
      }
    };

    checkCooldown();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      setErrorMsg('请输入群名称');
      return;
    }

    if (groupName.length > 8) {
      setErrorMsg('群名称最多8个汉字');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await groupAPI.createGroup({
        name: groupName.trim(),
        type: 'user_created',
      });

      if (response.code === 0 && response.data) {
        // 创建成功，进入群聊
        navigate(`/chat/${response.data.groupId}`);
      } else if (response.code === 3003) {
        // COOLDOWN_ACTIVE
        setErrorMsg('解散冷却中，4小时内无法创建新群');
      } else if (response.code === 3004) {
        // ALREADY_OWN_GROUP
        setErrorMsg('您已有创建的群，可解散后重新创建');
      } else {
        setErrorMsg(response.message || '创建失败');
      }
    } catch (error) {
      setErrorMsg('创建失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="create-group-page">
      <div className="create-group-container">
        <h2 className="create-group-title">创建群聊</h2>
        <p className="create-group-subtitle">一个用户只能创建一个群</p>

        {cooldownInfo && (
          <div className="cooldown-warning">{cooldownInfo}</div>
        )}

        <form onSubmit={handleSubmit} className="create-group-form">
          <div className="form-group">
            <label htmlFor="groupName">群名称</label>
            <input
              id="groupName"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="请输入群名称（最多8个字）"
              maxLength={8}
              disabled={!!cooldownInfo}
            />
            <div className="char-count">{groupName.length}/8</div>
          </div>

          {errorMsg && <div className="error-message">{errorMsg}</div>}

          <button
            type="submit"
            className="create-btn"
            disabled={isLoading || !!cooldownInfo}
          >
            {isLoading ? '创建中...' : '创建群聊'}
          </button>
        </form>

        <button
          className="cancel-btn"
          onClick={() => navigate('/')}
        >
          取消
        </button>
      </div>
    </div>
  );
};

export default CreateGroupPage;
