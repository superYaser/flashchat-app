/**
 * ============================================================================
 * 快闪群聊App - Emoji长度计算Hook
 * ============================================================================
 * 使用Intl.Segmenter标准计算文本长度，Emoji算2字符
 */

import { useMemo, useCallback } from 'react';

/**
 * Emoji长度计算Hook
 */
export function useEmojiLength() {
  // 创建Segmenter实例（只创建一次）
  const segmenter = useMemo(() => {
    return new Intl.Segmenter('zh', { granularity: 'grapheme' });
  }, []);

  /**
   * 计算文本长度
   * Emoji算2字符，普通字符算1字符
   */
  const calculateLength = useCallback((text: string): number => {
    const segments = Array.from(segmenter.segment(text));
    let length = 0;

    for (const { segment } of segments) {
      // 判断是否为Emoji（使用Unicode属性转义）
      if (/\p{Emoji_Presentation}/u.test(segment)) {
        length += 2;
      } else {
        length += 1;
      }
    }

    return length;
  }, [segmenter]);

  /**
   * 生成摘要（前24字 + ...）
   */
  const generateSummary = useCallback((text: string, maxLength: number = 24): string => {
    const segments = Array.from(segmenter.segment(text));
    let length = 0;
    let summary = '';

    for (const { segment } of segments) {
      const segmentLength = /\p{Emoji_Presentation}/u.test(segment) ? 2 : 1;

      if (length + segmentLength > maxLength) {
        break;
      }

      summary += segment;
      length += segmentLength;
    }

    return summary + '...';
  }, [segmenter]);

  /**
   * 检查文本长度
   */
  const checkLength = useCallback((text: string, maxLength: number = 50) => {
    const length = calculateLength(text);

    return {
      length,
      isValid: length <= maxLength,
      isTruncated: length > 24,
      remaining: Math.max(0, maxLength - length),
    };
  }, [calculateLength]);

  return {
    calculateLength,
    generateSummary,
    checkLength,
  };
}
