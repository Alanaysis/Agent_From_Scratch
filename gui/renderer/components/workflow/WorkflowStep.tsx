import React from 'react';

type Props = {
  label: string;
  status: 'completed' | 'active' | 'pending';
  isLast: boolean;
  onClick: () => void;
};

export function WorkflowStep({ label, status, isLast, onClick }: Props) {
  const icon = status === 'completed' ? '✓' : status === 'active' ? '▶' : '□';
  const iconColor =
    status === 'completed'
      ? 'var(--success)'
      : status === 'active'
        ? 'var(--accent)'
        : 'var(--text-muted)';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '6px 12px',
        cursor: 'pointer',
        position: 'relative',
        background: status === 'active' ? 'var(--accent-dim)' : 'transparent',
        borderLeft: status === 'active' ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (status !== 'active') {
          e.currentTarget.style.background = 'var(--bg-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (status !== 'active') {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginRight: 10,
          minWidth: 16,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: iconColor,
            lineHeight: 1,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {icon}
        </span>
        {!isLast && (
          <div
            style={{
              width: 1,
              height: 16,
              background: status === 'completed' ? 'var(--success)' : 'var(--border)',
              marginTop: 4,
              opacity: status === 'completed' ? 0.4 : 1,
            }}
          />
        )}
      </div>
      <span
        style={{
          fontSize: 11,
          color:
            status === 'active'
              ? 'var(--text-primary)'
              : status === 'completed'
                ? 'var(--text-muted)'
                : 'var(--text-secondary)',
          fontWeight: status === 'active' ? 600 : 400,
          lineHeight: '16px',
          marginTop: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}
