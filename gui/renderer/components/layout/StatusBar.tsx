import React from 'react';
import { useGlobalStore } from '../../state/globalStore';

export function StatusBar() {
  const statusBar = useGlobalStore((s) => s.statusBar);

  return (
    <div className="status-bar">
      <StatusItem
        dotColor={statusBar.machine.connected ? 'var(--success)' : 'var(--error)'}
        label={statusBar.machine.label}
      />
      <Divider />
      <StatusItem label={`Sim: ${statusBar.simulation.label}`} />
      <Divider />
      <StatusItem
        dotColor={statusBar.gpu.status === 'ok' ? 'var(--success)' : 'var(--warning)'}
        label={`GPU: ${statusBar.gpu.label}`}
      />
      <Divider />
      <StatusItem label={`Recipe: ${statusBar.recipe}`} />
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 400,
        }}
      >
        {statusBar.log}
      </div>
    </div>
  );
}

function StatusItem({ dotColor, label }: { dotColor?: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {dotColor && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 4px ${dotColor}`,
          }}
        />
      )}
      <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 12,
        background: 'var(--border)',
      }}
    />
  );
}
