/**
 * ============================================================================
 * 快闪群聊App - 群聊页
 * ============================================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWebSocketStore } from '../stores/websocketStore';
import { Message, Group } from '../types';
import './ChatPage.css';

const ChatPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuthStore();
  const {
    connected,
    messages,
    joinGroup,
    leaveGroup,
    sendMessage,
    deleteMessage,
  } = useWebSocketStore();

  const [inputValue, setInputValue] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [groupName, setGroupName] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 获取群名称
  useEffect(() => {
    if (groupId) {
      fetch(`${import.meta.env.VITE_API_URL}/groups/${groupId}`)
        .then(res => res.json())
        .then(data => {
          if (data.code === 0 && data.data) {
            setGroupName(data.data.name);
          }
        })
        .catch(err => console.error('获取群名称失败:', err));
    }
  }, [groupId]);

  // 加入群组
  useEffect(() => {
    if (connected && groupId) {
      joinGroup(groupId);

      return () => {
        leaveGroup(groupId);
      };
    }
  }, [connected, groupId, joinGroup, leaveGroup]);

  // 计算字符数（Emoji算2字符）
  const calculateLength = (text: string): number => {
    const chars = Array.from(text);
    let length = 0;
    for (const char of chars) {
      if (char.length > 1 || char.charCodeAt(0) > 255) {
        length += 2;
      } else {
        length += 1;
      }
    }
    return length;
  };

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const length = calculateLength(value);

    if (length <= 50) {
      setInputValue(value);
      setCharCount(length);
    }
  };

  // 发送消息
  const handleSend = () => {
    if (!inputValue.trim() || !groupId) return;

    sendMessage(groupId, inputValue.trim());
    setInputValue('');
    setCharCount(0);
    inputRef.current?.focus();
  };

  // 处理长按删除（仅群主）
  const handleMessageLongPress = (message: Message) => {
    if (groupId) {
      deleteMessage(message.id, groupId);
    }
  };

  return (
    <div className="chat-page">
      {/* 群名称头部 */}
      <div className="chat-header">
        <h2 className="group-name">{groupName || '群聊'}</h2>
      </div>

      {/* 消息列表 - 从下往上滚动 */}
      <div className="messages-container" ref={messagesContainerRef}>
        <div className="messages-scroll-area">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isSelf={message.sender.id === user?.id}
              onLongPress={() => handleMessageLongPress(message)}
            />
          ))}
        </div>
      </div>

      {/* 输入区域 */}
      <div className="chat-input-area">
        <div className="char-counter" data-exceeded={charCount > 24}>
          {charCount}/24
        </div>
        <div className="chat-input-group">
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入消息..."
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!inputValue.trim()}
          >
            发送
          </button>
        </div>
        {charCount > 24 && (
          <div className="summary-hint">超过24字将生成摘要</div>
        )}
      </div>
    </div>
  );
};

/**
 * 消息气泡组件
 */
interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
  onLongPress: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSelf,
  onLongPress,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`message-bubble ${isSelf ? 'self' : ''} ${message.type === 'system' ? 'system' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress();
      }}
    >
      <div className="message-sender">{message.sender.name}</div>
      <div className="message-content">
        {message.isTruncated && !expanded ? (
          <>
            {message.summary || message.content.substring(0, 24)}
            <span className="expand-btn" onClick={() => setExpanded(true)}>
              ...展开
            </span>
          </>
        ) : (
          message.content
        )}
      </div>
      <div className="message-time">
        {new Date(message.createdAt).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
};

export default ChatPage;
