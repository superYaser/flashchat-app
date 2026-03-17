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
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { userAPI } from '../api/client';

export const LoginScreen = ({ navigation }) => {
  const { login } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateInput = () => {
    if (!name || !password) {
      Alert.alert('错误', '请输入用户名和密码');
      return false;
    }
    if (name.length < 2) {
      Alert.alert('错误', '用户名至少2个字符');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('错误', '密码至少6个字符');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateInput()) return;

    setIsLoading(true);
    try {
      const api = isRegister ? userAPI.register : userAPI.login;
      const response = await api(name, password);

      if (response.code === 0 && response.data) {
        await login(response.data.user, response.data.token);
        Alert.alert('成功', isRegister ? '注册成功' : '登录成功');
        navigation.goBack();
      } else {
        Alert.alert('错误', response.message || (isRegister ? '注册失败' : '登录失败'));
      }
    } catch (error) {
      Alert.alert('错误', isRegister ? '注册失败，请重试' : '登录失败，请重试');
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.formContainer}>
            <Text style={styles.title}>
              {isRegister ? '注册账号' : '欢迎回来'}
            </Text>
            <Text style={styles.subtitle}>
              {isRegister ? '注册后即可创建群聊' : '登录后即可创建群聊'}
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>用户名</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="请输入用户名"
                maxLength={20}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>密码</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="请输入密码"
                maxLength={20}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading
                  ? isRegister
                    ? '注册中...'
                    : '登录中...'
                  : isRegister
                  ? '注册'
                  : '登录'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsRegister(!isRegister)}
            >
              <Text style={styles.switchButtonText}>
                {isRegister ? '已有账号？立即登录' : '没有账号？立即注册'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.tips}>提示：用户名2-20字符，密码至少6字符</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  formContainer: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 16,
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
  submitButton: {
    height: 48,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#4A90E2',
    fontSize: 14,
  },
  tips: {
    marginTop: 24,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
