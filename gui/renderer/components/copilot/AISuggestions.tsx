import React from 'react';
import { useGlobalStore } from '../../state/globalStore';

export function AISuggestions() {
  const suggestions = useGlobalStore((s) => s.suggestions);
  const applySuggestion = useGlobalStore((s) => s.applySuggestion);
  const ignoreSuggestion = useGlobalStore((s) => s.ignoreSuggestion);

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
        AI Suggestions
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {suggestions.map((s) => (
          <div
            key={s.id}
            style={{
              background: 'var(--bg-panel-alt)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 10px',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4 }}>
              {s.title}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.4 }}>
              {s.description}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 24,
                    height: 3,
                    background: 'var(--border)',
                    borderRadius: 1.5,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${s.confidence * 100}%`,
                      height: '100%',
                      background: s.confidence > 0.8 ? 'var(--success)' : 'var(--warning)',
                      borderRadius: 1.5,
                    }}
                  />
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {(s.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => applySuggestion(s.id)}
                  style={{
                    fontSize: 9,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    fontWeight: 600,
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6, 182, 212, 0.25)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-dim)'; }}
                >
                  Apply
                </button>
                <button
                  onClick={() => ignoreSuggestion(s.id)}
                  style={{
                    fontSize: 9,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    border: '1px solid var(--border)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Ignore
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
