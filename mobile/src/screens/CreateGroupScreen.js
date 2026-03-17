import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { groupAPI } from '../api/client';

export const CreateGroupScreen = ({ navigation }) => {
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('错误', '请输入群名称');
      return;
    }

    if (groupName.length > 8) {
      Alert.alert('错误', '群名称最多8个字符');
      return;
    }

    setIsLoading(true);
    try {
      const response = await groupAPI.createGroup(groupName.trim());

      if (response.code === 0) {
        Alert.alert('成功', '群聊创建成功', [
          {
            text: '确定',
            onPress: () => {
              navigation.replace('Chat', {
                groupId: response.data.groupId,
                groupName: response.data.name,
              });
            },
          },
        ]);
      } else if (response.code === 409) {
        Alert.alert('提示', '您已有创建的群，可解散后重新创建');
      } else if (response.code === 403) {
        Alert.alert('提示', response.message || '解散冷却中');
      } else {
        Alert.alert('错误', response.message || '创建失败');
      }
    } catch (error) {
      Alert.alert('错误', '创建群聊失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.title}>创建群聊</Text>
          <Text style={styles.subtitle}>给群聊起个名字吧</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>群名称</Text>
            <TextInput
              style={styles.input}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="请输入群名称（最多8字）"
              maxLength={8}
              autoFocus
            />
            <Text style={styles.charCount}>{groupName.length}/8</Text>
          </View>

          <TouchableOpacity
            style={[styles.createButton, isLoading && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={isLoading}
          >
            <Text style={styles.createButtonText}>
              {isLoading ? '创建中...' : '创建'}
            </Text>
          </TouchableOpacity>

          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>创建须知：</Text>
            <Text style={styles.tipsItem}>• 每人只能创建一个群聊</Text>
            <Text style={styles.tipsItem}>• 解散群聊后4小时内不能创建新群</Text>
            <Text style={styles.tipsItem}>• 群聊最多容纳20人</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f5f5f5',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  createButton: {
    height: 48,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tipsContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  tipsItem: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
});
