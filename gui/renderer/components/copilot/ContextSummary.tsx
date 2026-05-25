import React from 'react';
import { useGlobalStore } from '../../state/globalStore';

export function ContextSummary() {
  const context = useGlobalStore((s) => s.context);
  const sensitivity = useGlobalStore((s) => s.sensitivity);

  const items = [
    { label: 'Layer', value: context.layer },
    { label: 'Process', value: context.process },
    { label: 'Alignment', value: `${(context.alignmentConfidence * 100).toFixed(0)}%` },
    { label: 'ROI Count', value: String(context.roiCount) },
    { label: 'Sensitivity', value: sensitivity.value.toFixed(2) },
    { label: 'Recipe', value: context.recipeName },
  ];

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
        Current Context
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px 12px',
        }}
      >
        {items.map((item) => (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              {item.label}
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
