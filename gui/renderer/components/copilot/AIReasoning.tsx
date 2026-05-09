import React from 'react';
import { useGlobalStore } from '../../state/globalStore';

export function AIReasoning() {
  const reasoning = useGlobalStore((s) => s.reasoning);
  const context = useGlobalStore((s) => s.context);

  return (
    <div style={{ padding: '10px 12px' }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 8,
        }}
      >
        AI Reasoning
      </div>
      <div
        style={{
          background: 'var(--bg-panel-alt)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {reasoning}
        </div>
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingTop: 8,
            borderTop: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Confidence</span>
          <div
            style={{
              flex: 1,
              height: 4,
              background: 'var(--border)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${context.alignmentConfidence * 100}%`,
                height: '100%',
                background: 'var(--accent)',
                borderRadius: 2,
              }}
            />
          </div>
          <span
            style={{
              fontSize: 10,
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
            }}
          >
            {(context.alignmentConfidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}
