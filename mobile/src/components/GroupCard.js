import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

// 固定群卡片（自己创建的群）
export const FixedGroupCard = ({ group, onPress, containerWidth, containerHeight }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const cardWidth = 120;
    const cardHeight = 60;
    const maxX = Math.max(0, containerWidth - cardWidth);
    const maxY = Math.max(0, containerHeight - cardHeight);

    // 使用群组的初始位置或随机位置
    let initialX = Math.random() * maxX;
    let initialY = Math.random() * maxY;

    const groupPos = group.position;
    if (groupPos?.x) {
      const xPercent = parseFloat(String(groupPos.x).replace('%', '')) / 100;
      initialX = xPercent * maxX;
    }
    if (groupPos?.y) {
      const yPercent = parseFloat(String(groupPos.y).replace('%', '')) / 100;
      initialY = yPercent * maxY;
    }

    setPosition({ x: initialX, y: initialY });
  }, [containerWidth, containerHeight, group.position]);

  return (
    <TouchableOpacity
      style={[
        styles.groupCard,
        styles.ownGroupCard,
        { left: position.x, top: position.y }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.groupName}>{group.name}</Text>
      <Text style={styles.memberCount}>{group.memberCount}人</Text>
      <View style={styles.ownBadge}>
        <Text style={styles.ownBadgeText}>我的</Text>
      </View>
    </TouchableOpacity>
  );
};

// 游走群卡片（其他群）
export const WanderingGroupCard = ({ group, onPress, containerWidth, containerHeight }) => {
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const velocity = useRef({ vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 }).current;

  useEffect(() => {
    const cardWidth = 100;
    const cardHeight = 50;
    const maxX = Math.max(0, containerWidth - cardWidth);
    const maxY = Math.max(0, containerHeight - cardHeight);

    // 初始化位置
    let initialX = Math.random() * maxX;
    let initialY = Math.random() * maxY;

    const groupPos = group.position;
    if (groupPos?.x) {
      const xPercent = parseFloat(String(groupPos.x).replace('%', '')) / 100;
      initialX = xPercent * maxX;
    }
    if (groupPos?.y) {
      const yPercent = parseFloat(String(groupPos.y).replace('%', '')) / 100;
      initialY = yPercent * maxY;
    }

    position.setValue({ x: initialX, y: initialY });

    // 游走动画
    let currentX = initialX;
    let currentY = initialY;

    const animate = () => {
      currentX += velocity.vx;
      currentY += velocity.vy;

      // 边界检测
      if (currentX <= 0 || currentX >= maxX) {
        velocity.vx *= -1;
        currentX = Math.max(0, Math.min(currentX, maxX));
      }
      if (currentY <= 0 || currentY >= maxY) {
        velocity.vy *= -1;
        currentY = Math.max(0, Math.min(currentY, maxY));
      }

      position.setValue({ x: currentX, y: currentY });
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [containerWidth, containerHeight]);

  const getHeatColor = () => {
    switch (group.heatLevel) {
      case 'medium':
        return '#4A90E2';
      case 'high':
        return '#F5A623';
      case 'extreme':
        return '#D0021B';
      default:
        return '#999999';
    }
  };

  return (
    <Animated.View style={{ position: 'absolute', transform: [{ translateX: position.x }, { translateY: position.y }] }}>
      <TouchableOpacity
        style={[
          styles.groupCard,
          { borderColor: getHeatColor() }
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.memberCount}>{group.memberCount}人</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  groupCard: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 2,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ownGroupCard: {
    backgroundColor: '#FFD700',
    borderColor: '#FF6B00',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  memberCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  ownBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF6B00',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ownBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
});
