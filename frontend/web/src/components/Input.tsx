/**
 * ============================================================================
 * 快闪群聊App - 输入框组件
 * ============================================================================
 */

import React, { forwardRef } from 'react';
import './Input.css';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'tel' | 'number';
  maxLength?: number;
  disabled?: boolean;
  error?: string;
  label?: string;
  charCount?: number;
  maxCharCount?: number;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      value,
      onChange,
      placeholder,
      type = 'text',
      maxLength,
      disabled,
      error,
      label,
      charCount,
      maxCharCount,
    },
    ref
  ) => {
    const showCharCount = charCount !== undefined && maxCharCount !== undefined;
    const isExceeded = showCharCount && charCount > maxCharCount;

    return (
      <div className="input-wrapper">
        {label && <label className="input-label">{label}</label>}
        <div className="input-container">
          <input
            ref={ref}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={disabled}
            className={`input ${error ? 'input-error' : ''}`}
          />
          {showCharCount && (
            <span className={`char-count ${isExceeded ? 'exceeded' : ''}`}>
              {charCount}/{maxCharCount}
            </span>
          )}
        </div>
        {error && <span className="input-error-message">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
