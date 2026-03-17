/**
 * ============================================================================
 * 快闪群聊App - 首页（广场）
 * ============================================================================
 * 
 * 功能说明：
 * 1. 展示所有用户创建的群，群卡片在屏幕上游走
 * 2. 当前用户自己创建的群固定不动，并有金色高亮
 * 3. 支持发送弹幕消息
 * 4. 点击群卡片进入群聊
 * 
 * 核心组件：
 * - FixedGroupCard: 固定群卡片（自己创建的群）
 * - WanderingGroupCard: 游走群卡片（其他用户的群）
 * - DanmakuItem: 弹幕项组件
 * 
 * 状态管理：
 * - 使用websocketStore管理WebSocket连接和数据
 * - 使用authStore管理用户认证状态
 * 
 * 动画实现：
 * - 使用requestAnimationFrame实现平滑的游走动画
 * - 边界碰撞检测实现反弹效果
 * ============================================================================
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWebSocketStore } from '../stores/websocketStore';
import { wsClient } from '../api/websocket';
import { Group, Danmaku } from '../types';
import './HomePage.css';

// ============================================================================
// 固定群卡片组件 - 自己创建的群
// ============================================================================

interface FixedGroupCardProps {
  group: Group;                    // 群组数据
  onClick: () => void;             // 点击回调
  containerWidth: number;          // 容器宽度
  containerHeight: number;         // 容器高度
}

/**
 * 固定群卡片组件
 * 特点：
 * - 位置固定不动
 * - 金色高亮显示
 * - 显示"我的"标识
 */
const FixedGroupCard: React.FC<FixedGroupCardProps> = ({ 
  group, 
  onClick,
  containerWidth,
  containerHeight 
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // 初始化位置（只执行一次）
  useEffect(() => {
    const cardWidth = 120;
    const cardHeight = 60;
    const maxX = Math.max(0, containerWidth - cardWidth);
    const maxY = Math.max(0, containerHeight - cardHeight);

    // 使用群组的初始位置或随机位置
    let initialX = Math.random() * maxX;
    let initialY = Math.random() * maxY;

    // 解析后端返回的百分比位置
    const groupPos = (group as any).position;
    if (groupPos?.x) {
      const xPercent = parseFloat(String(groupPos.x).replace('%', '')) / 100;
      initialX = xPercent * maxX;
    }
    if (groupPos?.y) {
      const yPercent = parseFloat(String(groupPos.y).replace('%', '')) / 100;
      initialY = yPercent * maxY;
    }

    setPosition({ x: initialX, y: initialY });
  }, [containerWidth, containerHeight, group]);

  return (
    <div
      className="group-card fixed own-group-fixed"
      style={{
        left: position.x,
        top: position.y,
        position: 'absolute',
      }}
      onClick={onClick}
    >
      <span className="group-name">{group.name}</span>
      <span className="member-count">{group.memberCount}人</span>
      <span className="own-badge">我的</span>
    </div>
  );
};

// ============================================================================
// 游走群卡片组件 - 其他用户的群
// ============================================================================

interface WanderingGroupCardProps {
  group: Group;
  onClick: () => void;
  containerWidth: number;
  containerHeight: number;
}

/**
 * 游走群卡片组件
 * 特点：
 * - 在屏幕内随机游走
 * - 边界碰撞反弹
 * - 根据热度显示不同颜色
 */
const WanderingGroupCard: React.FC<WanderingGroupCardProps> = ({ 
  group, 
  onClick,
  containerWidth,
  containerHeight 
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // 速度向量，控制游走方向和速度
  const velocityRef = useRef({ 
    vx: (Math.random() - 0.5) * 2,  // X轴速度：-1 到 1
    vy: (Math.random() - 0.5) * 2   // Y轴速度：-1 到 1
  });

  const animationRef = useRef<number | null>(null);

  // 初始化位置
  useEffect(() => {
    const cardWidth = 100;
    const cardHeight = 50;
    const maxX = Math.max(0, containerWidth - cardWidth);
    const maxY = Math.max(0, containerHeight - cardHeight);

    // 使用群组的初始位置或随机位置
    let initialX = Math.random() * maxX;
    let initialY = Math.random() * maxY;

    const groupPos = (group as any).position;
    if (groupPos?.x) {
      const xStr = String(groupPos.x);
      const xPercent = parseFloat(xStr.replace('%', '')) / 100;
      initialX = xPercent * maxX;
    }
    if (groupPos?.y) {
      const yStr = String(groupPos.y);
      const yPercent = parseFloat(yStr.replace('%', '')) / 100;
      initialY = yPercent * maxY;
    }

    setPosition({ x: initialX, y: initialY });
  }, [containerWidth, containerHeight, group]);

  // 游走动画
  useEffect(() => {
    // 自己创建的群不游走（由FixedGroupCard处理）
    if (group.ownerId) {
      return;
    }

    const cardWidth = 100;
    const cardHeight = 50;

    /**
     * 动画循环
     * 每帧更新位置，检测边界碰撞
     */
    const animate = () => {
      setPosition(prev => {
        const maxX = Math.max(0, containerWidth - cardWidth);
        const maxY = Math.max(0, containerHeight - cardHeight);

        let newX = prev.x + velocityRef.current.vx;
        let newY = prev.y + velocityRef.current.vy;

        // 边界碰撞检测：碰到边界时反转速度方向
        if (newX <= 0 || newX >= maxX) {
          velocityRef.current.vx *= -1;
          newX = Math.max(0, Math.min(newX, maxX));
        }
        if (newY <= 0 || newY >= maxY) {
          velocityRef.current.vy *= -1;
          newY = Math.max(0, Math.min(newY, maxY));
        }

        return { x: newX, y: newY };
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    // 清理函数：组件卸载时取消动画
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [containerWidth, containerHeight, group.ownerId]);

  /**
   * 根据热度等级获取边框颜色
   * low: 灰色, medium: 蓝色, high: 橙色, extreme: 红色
   */
  const getHeatClass = () => {
    switch (group.heatLevel) {
      case 'medium':
        return 'heat-medium';
      case 'high':
        return 'heat-high';
      case 'extreme':
        return 'heat-extreme';
      default:
        return 'heat-low';
    }
  };

  return (
    <div
      className={`group-card wandering ${getHeatClass()} ${group.isSystem ? 'system' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        position: 'absolute',
      }}
      onClick={onClick}
    >
      <span className="group-name">{group.name}</span>
      <span className="member-count">{group.memberCount}人</span>
      {group.isSystem && <span className="system-badge">★</span>}
    </div>
  );
};

// ============================================================================
// 首页主组件
// ============================================================================

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const {
    connected,
    homeGroups,
    joinHome,
    leaveHome,
    sendDanmaku,
  } = useWebSocketStore();

  const danmakuInputRef = useRef<HTMLInputElement>(null);
  const [localDanmakuList, setLocalDanmakuList] = useState<Danmaku[]>([]);
  const groupsAreaRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // 获取容器尺寸（用于计算群卡片位置）
  useEffect(() => {
    const updateSize = () => {
      if (groupsAreaRef.current) {
        setContainerSize({
          width: groupsAreaRef.current.clientWidth,
          height: groupsAreaRef.current.clientHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // 加入首页（WebSocket连接成功后）
  useEffect(() => {
    if (connected) {
      const userId = user?.id || 'guest_' + Date.now();
      joinHome(userId);
    }

    return () => {
      leaveHome();
    };
  }, [connected, user?.id]);

  // 监听弹幕更新
  useEffect(() => {
    const handleDanmaku = (danmaku: Danmaku) => {
      setLocalDanmakuList(prev => [...prev.slice(-20), danmaku]);
    };

    wsClient.on('danmaku', handleDanmaku);

    return () => {
      wsClient.off('danmaku', handleDanmaku);
    };
  }, []);

  // 处理群组点击 - 进入群聊
  const handleGroupClick = (group: Group) => {
    navigate(`/chat/${group.id}`);
  };

  // 处理弹幕发送
  const handleDanmakuSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = danmakuInputRef.current?.value.trim();
    if (content) {
      sendDanmaku(content);
      danmakuInputRef.current!.value = '';
    }
  };

  // 处理创建群
  const handleCreateGroup = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    navigate('/create-group');
  };

  // 判断是否是自己创建的群
  const isOwnGroup = useCallback((group: Group) => {
    return group.ownerId === user?.id;
  }, [user?.id]);

  // 分离自己创建的群和其他群
  const ownGroups = homeGroups.filter(isOwnGroup);
  const otherGroups = homeGroups.filter((g) => !isOwnGroup(g));

  return (
    <div className="home-page">
      {/* 连接状态指示 */}
      {!connected && (
        <div className="connection-status">
          <span className="connecting">正在连接...</span>
        </div>
      )}

      {/* 群组游走区域 */}
      <div className="groups-area" ref={groupsAreaRef}>
        {homeGroups.length === 0 && connected && (
          <div className="no-groups">暂无群组</div>
        )}

        {/* 渲染自己创建的群（固定不动） */}
        {containerSize.width > 0 && ownGroups.map((group) => (
          <FixedGroupCard
            key={group.id}
            group={group}
            onClick={() => handleGroupClick(group)}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        ))}

        {/* 渲染其他群（游走） */}
        {containerSize.width > 0 && otherGroups.map((group) => (
          <WanderingGroupCard
            key={group.id}
            group={group}
            onClick={() => handleGroupClick(group)}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        ))}

        {/* 弹幕层 */}
        <div className="danmaku-layer">
          {localDanmakuList.map((danmaku) => (
            <DanmakuItem 
              key={danmaku.id} 
              danmaku={danmaku} 
              isSelf={danmaku.senderId === user?.id}
            />
          ))}
        </div>
      </div>

      {/* 底部输入区 */}
      <div className="input-area">
        <form onSubmit={handleDanmakuSubmit} className="danmaku-form">
          <input
            ref={danmakuInputRef}
            type="text"
            className="danmaku-input"
            placeholder="发送弹幕..."
            maxLength={50}
          />
          <button type="submit" className="send-btn">
            发送
          </button>
          <button
            type="button"
            className="create-group-btn"
            onClick={handleCreateGroup}
          >
            +
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 弹幕项组件
// ============================================================================

interface DanmakuItemProps {
  danmaku: Danmaku;    // 弹幕数据
  isSelf?: boolean;    // 是否是自己发送的
}

/**
 * 弹幕项组件
 * 特点：
 * - 不显示用户名
 * - 自己发送的弹幕高亮显示（蓝色）
 */
const DanmakuItem: React.FC<DanmakuItemProps> = ({ danmaku, isSelf }) => {
  return (
    <div
      className={`danmaku-item ${isSelf ? 'self' : ''}`}
      style={{
        top: `${(danmaku.track || 0) * 40 + 30}px`,
        animationDuration: `${danmaku.duration || 8000}ms`,
      }}
    >
      <span className="danmaku-content">{danmaku.content}</span>
    </div>
  );
};

export default HomePage;
