import React, { useState } from 'react';
import { useGlobalStore } from '../../state/globalStore';

export function ChatInput() {
  const sendMessage = useGlobalStore((s) => s.sendMessage);
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      sendMessage(value.trim());
      setValue('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '0 10px',
          transition: 'border-color 0.15s',
        }}
      >
        <span
          style={{
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            marginRight: 8,
            opacity: 0.6,
          }}
        >
          &gt;
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type a command or question..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            padding: '8px 0',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
          }}
          onFocus={(e) => {
            e.currentTarget.parentElement!.style.borderColor = 'var(--accent)';
          }}
          onBlur={(e) => {
            e.currentTarget.parentElement!.style.borderColor = 'var(--border)';
          }}
        />
        <button
          type="submit"
          style={{
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: 10,
            padding: '4px 8px',
            fontWeight: 600,
            letterSpacing: '0.5px',
          }}
        >
          SEND
        </button>
      </div>
    </form>
  );
}
