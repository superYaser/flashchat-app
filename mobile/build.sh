#!/bin/bash

# 快闪群聊移动端构建脚本

echo "========================================"
echo "快闪群聊移动端构建脚本"
echo "========================================"

# 检查参数
if [ "$1" == "android" ]; then
    echo "开始构建 Android APK..."
    eas build --platform android --profile preview
elif [ "$1" == "ios" ]; then
    echo "开始构建 iOS IPA..."
    eas build --platform ios --profile preview
elif [ "$1" == "local" ]; then
    echo "启动本地开发服务器..."
    npx expo start
else
    echo "用法: ./build.sh [android|ios|local]"
    echo ""
    echo "选项:"
    echo "  android - 构建 Android APK"
    echo "  ios     - 构建 iOS IPA"
    echo "  local   - 启动本地开发服务器"
    exit 1
fi
