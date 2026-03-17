import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useWebSocketStore } from '../stores/websocketStore';
import { MessageBubble } from '../components/MessageBubble';
import { InputBar } from '../components/InputBar';
import { groupAPI } from '../api/client';

export const ChatScreen = ({ route, navigation }) => {
  const { groupId, groupName } = route.params || {};
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
  const [groupInfo, setGroupInfo] = useState(null);

  // 获取群信息
  useEffect(() => {
    const fetchGroupInfo = async () => {
      try {
        const response = await groupAPI.getGroupById(groupId);
        if (response.code === 0) {
          setGroupInfo(response.data);
          navigation.setOptions({ title: response.data.name });
        }
      } catch (error) {
        console.error('获取群信息失败:', error);
      }
    };

    fetchGroupInfo();
  }, [groupId]);

  // 加入群组
  useEffect(() => {
    if (connected && groupId) {
      joinGroup(groupId);

      return () => {
        leaveGroup(groupId);
      };
    }
  }, [connected, groupId]);

  // 计算字符数
  const calculateLength = (text) => {
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
  const handleInputChange = (text) => {
    const length = calculateLength(text);
    if (length <= 50) {
      setInputValue(text);
      setCharCount(length);
    }
  };

  // 发送消息
  const handleSend = () => {
    if (!inputValue.trim() || !groupId) return;

    sendMessage(groupId, inputValue.trim());
    setInputValue('');
    setCharCount(0);
  };

  // 长按删除消息（仅群主）
  const handleLongPress = (message) => {
    if (groupInfo?.ownerId !== user?.id) return;

    Alert.alert(
      '删除消息',
      '确定要删除这条消息吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => deleteMessage(message.id, groupId),
        },
      ]
    );
  };

  // 渲染消息
  const renderMessage = ({ item }) => (
    <MessageBubble
      message={item}
      isSelf={item.sender?.id === user?.id}
      onLongPress={() => handleLongPress(item)}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* 群名称头部 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{groupInfo?.name || groupName || '群聊'}</Text>
        </View>

        {/* 消息列表 */}
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted={false}
        />

        {/* 输入栏 */}
        <InputBar
          value={inputValue}
          onChangeText={handleInputChange}
          onSend={handleSend}
          charCount={charCount}
          placeholder="输入消息..."
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  messagesList: {
    padding: 16,
    paddingBottom: 20,
  },
});
