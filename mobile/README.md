# 快闪群聊 - 移动端

基于 React Native + Expo 开发的跨平台移动应用。

## 功能特性

- 📱 支持 iOS 和 Android 双平台
- 💬 实时群聊（WebSocket）
- 🎮 群卡片游走展示
- 📝 弹幕消息
- 🔐 用户注册/登录
- ➕ 创建群聊
- 🕐 5分钟消息生命周期
- 📊 消息摘要（24字以上）

## 技术栈

- React Native 0.73
- Expo SDK 50
- Socket.io Client
- Zustand（状态管理）
- React Navigation

## 快速开始

### 1. 安装依赖

```bash
cd mobile
npm install
```

### 2. 启动开发服务器

```bash
npx expo start
```

### 3. 在模拟器/真机上运行

- 按 `i` 启动 iOS 模拟器
- 按 `a` 启动 Android 模拟器
- 扫描二维码在真机上运行

## 构建发布版本

### Android APK

```bash
./build.sh android
```

### iOS IPA

```bash
./build.sh ios
```

## 项目结构

```
mobile/
├── App.js                 # 主入口
├── src/
│   ├── api/              # API 客户端
│   ├── components/       # 可复用组件
│   ├── screens/          # 页面组件
│   ├── stores/           # 状态管理
│   ├── utils/            # 工具函数
│   └── constants/        # 常量配置
└── assets/               # 静态资源
```

## 后端API

- 开发环境: `http://47.238.110.59:3001`
- WebSocket: `http://47.238.110.59:3001`

## 许可证

MIT
