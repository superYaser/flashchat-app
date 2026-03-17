import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export const DanmakuItem = ({ danmaku, isSelf }) => {
  return (
    <View style={[styles.danmakuItem, isSelf && styles.selfDanmaku]}>
      <Text style={styles.danmakuContent}>{danmaku.content}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  danmakuItem: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 4,
  },
  selfDanmaku: {
    backgroundColor: '#4A90E2',
  },
  danmakuContent: {
    fontSize: 14,
    color: '#fff',
  },
});
