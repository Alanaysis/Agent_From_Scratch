import React, { useRef, useEffect, useState } from 'react';
import { useGlobalStore } from '../../state/globalStore';
import { WaferRenderer } from './WaferRenderer';

export function WaferCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WaferRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const roi = useGlobalStore((s) => s.roi);
  const alignment = useGlobalStore((s) => s.alignment);
  const ui = useGlobalStore((s) => s.ui);
  const setZoom = useGlobalStore((s) => s.setZoom);

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const renderer = new WaferRenderer(el);
    rendererRef.current = renderer;

    const startInit = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        renderer.init()
          .then(() => setReady(true))
          .catch((err) => {
            console.error('PixiJS init failed:', err);
            setError(String(err));
          });
      }
    };

    if (el.clientWidth > 0 && el.clientHeight > 0) {
      startInit();
    } else {
      const observer = new ResizeObserver(() => {
        if (el.clientWidth > 0 && el.clientHeight > 0) {
          observer.disconnect();
          startInit();
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready && rendererRef.current) {
      rendererRef.current.updateROI(roi);
      rendererRef.current.updateAlignment(alignment.markers);
      rendererRef.current.setZoom(ui.zoom);
    }
  }, [ready, roi, alignment, ui.zoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(ui.zoom + delta);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [ui.zoom, setZoom]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <CanvasToolbar />
      {error ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            padding: 20,
            textAlign: 'center',
          }}
        >
          PixiJS Error: {error}
        </div>
      ) : !ready ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
        >
          Loading visualization...
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: '#080c12',
          }}
        />
      )}
    </div>
  );
}

function CanvasToolbar() {
  const ui = useGlobalStore((s) => s.ui);
  const setZoom = useGlobalStore((s) => s.setZoom);
  const setActiveOverlay = useGlobalStore((s) => s.setActiveOverlay);

  const overlays = [
    { id: 'all', label: 'All' },
    { id: 'roi', label: 'ROI' },
    { id: 'defects', label: 'Defects' },
    { id: 'alignment', label: 'Align' },
    { id: 'grid', label: 'Grid' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: 'var(--bg-panel-alt)',
        borderBottom: '1px solid var(--border)',
        minHeight: 32,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {overlays.map((o) => (
          <button
            key={o.id}
            onClick={() => setActiveOverlay(o.id)}
            style={{
              fontSize: 9,
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              background: ui.activeOverlay === o.id ? 'var(--accent-dim)' : 'transparent',
              color: ui.activeOverlay === o.id ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: ui.activeOverlay === o.id ? 600 : 400,
              border: `1px solid ${ui.activeOverlay === o.id ? 'rgba(6, 182, 212, 0.3)' : 'transparent'}`,
              transition: 'all 0.15s',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => setZoom(ui.zoom - 0.25)}
          style={{
            fontSize: 11,
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          −
        </button>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            minWidth: 36,
            textAlign: 'center',
          }}
        >
          {(ui.zoom * 100).toFixed(0)}%
        </span>
        <button
          onClick={() => setZoom(ui.zoom + 0.25)}
          style={{
            fontSize: 11,
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          +
        </button>
        <button
          onClick={() => setZoom(1)}
          style={{
            fontSize: 9,
            padding: '3px 6px',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            marginLeft: 4,
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          WF-2024-001
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          300mm
        </span>
      </div>
    </div>
  );
}
