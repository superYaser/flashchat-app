import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from './src/stores/authStore';
import { useWebSocketStore } from './src/stores/websocketStore';

// 页面
import { HomeScreen } from './src/screens/HomeScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { CreateGroupScreen } from './src/screens/CreateGroupScreen';

const Stack = createStackNavigator();

// 导航器组件
const AppNavigator = () => {
  const { isAuthenticated, init } = useAuthStore();
  const { connect } = useWebSocketStore();

  // 初始化认证状态
  useEffect(() => {
    init();
  }, []);

  // 连接WebSocket
  useEffect(() => {
    connect();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTintColor: '#4A90E2',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={({ route }) => ({
            title: route.params?.groupName || '群聊',
          })}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: '登录' }}
        />
        <Stack.Screen
          name="CreateGroup"
          component={CreateGroupScreen}
          options={{ title: '创建群聊' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// 主应用组件
export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}
