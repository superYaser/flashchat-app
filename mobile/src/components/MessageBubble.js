import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const MessageBubble = ({ message, isSelf, onLongPress }) => {
  const [expanded, setExpanded] = useState(false);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity
      style={[styles.bubble, isSelf ? styles.selfBubble : styles.otherBubble]}
      onLongPress={onLongPress}
      activeOpacity={0.9}
    >
      <Text style={styles.senderName}>{message.sender?.name || '未知用户'}</Text>
      <Text style={styles.messageContent}>
        {message.isTruncated && !expanded 
          ? (message.summary || message.content?.substring(0, 24)) 
          : message.content}
        {message.isTruncated && !expanded && (
          <Text style={styles.expandText} onPress={() => setExpanded(true)}>...展开</Text>
        )}
      </Text>
      <Text style={styles.messageTime}>{formatTime(message.createdAt)}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selfBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 3,
    borderLeftColor: '#4A90E2',
  },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A90E2',
    marginBottom: 4,
  },
  messageContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  expandText: {
    color: '#4A90E2',
    fontSize: 12,
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
});
