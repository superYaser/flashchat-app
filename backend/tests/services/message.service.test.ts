/**
 * ============================================================================
 * 快闪群聊App - 消息服务测试
 * ============================================================================
 */

import { MessageService } from '../../src/services/message/message.service';

describe('MessageService', () => {
  let messageService: MessageService;

  beforeEach(() => {
    messageService = new MessageService();
  });

  describe('calculateLengthWithEmoji', () => {
    it('should count regular characters as 1', () => {
      const length = messageService.calculateLengthWithEmoji('Hello World');
      expect(length).toBe(11);
    });

    it('should count Chinese characters as 1', () => {
      const length = messageService.calculateLengthWithEmoji('你好世界');
      expect(length).toBe(4);
    });

    it('should count emoji as 2', () => {
      const length = messageService.calculateLengthWithEmoji('😊');
      expect(length).toBe(2);
    });

    it('should count mixed content correctly', () => {
      const length = messageService.calculateLengthWithEmoji('Hello😊世界');
      expect(length).toBe(9); // 5 + 2 + 2
    });

    it('should handle multiple emojis', () => {
      const length = messageService.calculateLengthWithEmoji('😊😂🎉');
      expect(length).toBe(6); // 3 * 2
    });

    it('should handle emoji with skin tone modifier', () => {
      const length = messageService.calculateLengthWithEmoji('👍🏻');
      expect(length).toBe(2);
    });

    it('should handle flag emoji', () => {
      const length = messageService.calculateLengthWithEmoji('🇨🇳');
      expect(length).toBe(2);
    });
  });

  describe('checkMessageLength', () => {
    it('should return valid for short messages', () => {
      const result = messageService.checkMessageLength('Hello');
      expect(result.valid).toBe(true);
      expect(result.displayMode).toBe('full');
    });

    it('should return summary mode for messages over 24 chars', () => {
      const longMessage = '这是一段超过24个字符的消息内容用于测试摘要功能';
      const result = messageService.checkMessageLength(longMessage);
      expect(result.valid).toBe(true);
      expect(result.displayMode).toBe('summary');
      expect(result.summary).toBeDefined();
    });

    it('should return invalid for messages over 50 chars', () => {
      const veryLongMessage = '这是一段非常长的消息内容，超过了50个字符的限制，应该返回无效状态用于测试';
      const result = messageService.checkMessageLength(veryLongMessage);
      expect(result.valid).toBe(false);
    });

    it('should handle emoji correctly in length check', () => {
      const messageWithEmoji = '😊'.repeat(15); // 30 chars
      const result = messageService.checkMessageLength(messageWithEmoji);
      expect(result.valid).toBe(true);
      expect(result.length).toBe(30);
    });
  });

  describe('formatMessageContent', () => {
    it('should format short message into single line', () => {
      const result = messageService.formatMessageContent('Hello');
      expect(result.line1).toBe('Hello');
      expect(result.line2).toBe('');
    });

    it('should format long message into two lines', () => {
      const longMessage = '这是一段很长的消息内容需要分成两行显示';
      const result = messageService.formatMessageContent(longMessage);
      expect(result.line1).toBeDefined();
      expect(result.line2).toBeDefined();
    });

    it('should truncate message exceeding two lines', () => {
      const veryLongMessage = '这是一段非常长的消息内容超过了24个字符需要截断处理只显示前两行';
      const result = messageService.formatMessageContent(veryLongMessage);
      expect(result.line1.length).toBeLessThanOrEqual(12);
    });
  });
});
