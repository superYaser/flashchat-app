import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useWebSocketStore } from '../stores/websocketStore';
import { wsClient } from '../api/websocket';
import { FixedGroupCard, WanderingGroupCard } from '../components/GroupCard';
import { DanmakuItem } from '../components/DanmakuItem';
import { groupAPI } from '../api/client';

const { width, height } = Dimensions.get('window');

export const HomeScreen = ({ navigation }) => {
  const { user, isAuthenticated } = useAuthStore();
  const {
    connected,
    homeGroups,
    danmakuList,
    joinHome,
    leaveHome,
    sendDanmaku,
    setHomeGroups,
  } = useWebSocketStore();

  const [localDanmakuList, setLocalDanmakuList] = useState([]);
  const [danmakuInput, setDanmakuInput] = useState('');
  const [containerSize] = useState({ width: width, height: height - 200 });

  // 加载群组列表
  useEffect(() => {
    loadGroups();
  }, []);

  // 连接WebSocket
  useEffect(() => {
    if (!connected) {
      useWebSocketStore.getState().connect();
    }
  }, []);

  // 加入首页
  useEffect(() => {
    if (connected && user?.id) {
      joinHome(user?.id || 'guest_' + Date.now());
    }

    return () => {
      leaveHome();
    };
  }, [connected, user?.id]);

  // 监听弹幕
  useEffect(() => {
    const handleDanmaku = (danmaku) => {
      setLocalDanmakuList((prev) => [...prev.slice(-20), danmaku]);
    };

    wsClient.on('danmaku', handleDanmaku);

    return () => {
      wsClient.off('danmaku', handleDanmaku);
    };
  }, []);

  const loadGroups = async () => {
    try {
      const response = await groupAPI.getGroups();
      if (response.code === 0) {
        setHomeGroups(response.data);
      }
    } catch (error) {
      console.error('加载群组失败:', error);
    }
  };

  // 判断是否是自己创建的群
  const isOwnGroup = useCallback(
    (group) => {
      return group.ownerId === user?.id;
    },
    [user?.id]
  );

  // 分离自己创建的群和其他群
  const ownGroups = homeGroups.filter(isOwnGroup);
  const otherGroups = homeGroups.filter((g) => !isOwnGroup(g));

  // 处理群点击
  const handleGroupPress = (group) => {
    navigation.navigate('Chat', { groupId: group.id, groupName: group.name });
  };

  // 发送弹幕
  const handleSendDanmaku = () => {
    if (!danmakuInput.trim()) return;
    sendDanmaku(danmakuInput.trim());
    setDanmakuInput('');
  };

  // 创建群
  const handleCreateGroup = () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate('CreateGroup');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 标题栏 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>快闪群聊</Text>
      </View>

      {/* 群组区域 */}
      <View style={styles.groupsArea}>
        {homeGroups.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无群组</Text>
          </View>
        )}

        {/* 自己创建的群（固定不动） */}
        {ownGroups.map((group) => (
          <FixedGroupCard
            key={group.id}
            group={group}
            onPress={() => handleGroupPress(group)}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        ))}

        {/* 其他群（游走） */}
        {otherGroups.map((group) => (
          <WanderingGroupCard
            key={group.id}
            group={group}
            onPress={() => handleGroupPress(group)}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        ))}

        {/* 弹幕层 */}
        <View style={styles.danmakuLayer}>
          {localDanmakuList.map((danmaku, index) => (
            <View
              key={danmaku.id}
              style={[
                styles.danmakuWrapper,
                { top: (index % 5) * 40 + 30 },
              ]}
            >
              <DanmakuItem
                danmaku={danmaku}
                isSelf={danmaku.senderId === user?.id}
              />
            </View>
          ))}
        </View>
      </View>

      {/* 底部输入区 */}
      <View style={styles.inputArea}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.danmakuInput}
            value={danmakuInput}
            onChangeText={setDanmakuInput}
            placeholder="发送弹幕..."
            maxLength={50}
            returnKeyType="send"
            onSubmitEditing={handleSendDanmaku}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSendDanmaku}>
            <Text style={styles.sendButtonText}>发送</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateGroup}>
            <Text style={styles.createButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    height: 56,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  groupsArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  danmakuLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 100,
    pointerEvents: 'none',
  },
  danmakuWrapper: {
    position: 'absolute',
    left: 0,
  },
  inputArea: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  danmakuInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    backgroundColor: '#f5f5f5',
  },
  sendButton: {
    marginLeft: 8,
    height: 44,
    paddingHorizontal: 20,
    backgroundColor: '#4A90E2',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 24,
    color: '#4A90E2',
    fontWeight: '300',
  },
});
