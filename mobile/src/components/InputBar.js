import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

export const InputBar = ({ 
  value, 
  onChangeText, 
  onSend, 
  placeholder = '输入消息...',
  maxLength = 50,
  charCount = 0 
}) => {
  return (
    <View style={styles.container}>
      <Text style={[styles.charCount, charCount > 24 && styles.charCountWarning]}>
        {charCount}/24
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          maxLength={maxLength}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, !value.trim() && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={!value.trim()}
        >
          <Text style={styles.sendButtonText}>发送</Text>
        </TouchableOpacity>
      </View>
      {charCount > 24 && (
        <Text style={styles.summaryHint}>超过24字将生成摘要</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginBottom: 4,
  },
  charCountWarning: {
    color: '#F5A623',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
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
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryHint: {
    fontSize: 11,
    color: '#F5A623',
    textAlign: 'center',
    marginTop: 4,
  },
});
