import React from 'react';

type Props = {
  title: string;
  badge?: string;
  children?: React.ReactNode;
};

export function PanelHeader({ title, badge, children }: Props) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {badge && <span className="badge">{badge}</span>}
        {children}
      </div>
    </div>
  );
}
