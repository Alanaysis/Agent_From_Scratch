'use client'

import * as React from 'react'

export type ThemeId = 'obsidian' | 'one-dark' | 'github-light' | 'dracula' | 'solarized-light' | 'silkent'

export const THEMES: Record<ThemeId, { name: string; description: string; preview: { bg: string; text: string; accent: string } }> = {
  obsidian: {
    name: 'Obsidian',
    description: 'Warm dark theme',
    preview: { bg: '#080808', text: '#f5f0ea', accent: '#d4a574' },
  },
  'one-dark': {
    name: 'One Dark',
    description: 'VS Code One Dark',
    preview: { bg: '#1e2127', text: '#e6e6e6', accent: '#61afef' },
  },
  dracula: {
    name: 'Dracula',
    description: 'Purple-tinted dark',
    preview: { bg: '#21222c', text: '#f8f8f2', accent: '#bd93f9' },
  },
  'github-light': {
    name: 'GitHub Light',
    description: 'Clean light theme',
    preview: { bg: '#f6f8fa', text: '#1f2328', accent: '#0969da' },
  },
  'solarized-light': {
    name: 'Solarized Light',
    description: 'Warm light theme',
    preview: { bg: '#fdf6e3', text: '#073642', accent: '#268bd2' },
  },
  silkent: {
    name: 'Silkent',
    description: 'SIOK WaferInspect',
    preview: { bg: '#FFFFFF', text: '#333333', accent: '#0086CD' },
  },
}

function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'obsidian'
  const stored = localStorage.getItem('irg-theme')
  if (stored && stored in THEMES) return stored as ThemeId
  return 'obsidian'
}

function applyTheme(theme: ThemeId) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('irg-theme', theme)
}

export function useTheme() {
  const [theme, setThemeState] = React.useState<ThemeId>('obsidian')

  React.useEffect(() => {
    const stored = getStoredTheme()
    setThemeState(stored)
    applyTheme(stored)
  }, [])

  const setTheme = React.useCallback((newTheme: ThemeId) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
  }, [])

  return { theme, setTheme }
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: 8,
    }}>
      {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(([id, t]) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            padding: 0,
            border: theme === id
              ? `2px solid ${t.preview.accent}`
              : '2px solid var(--border-subtle)',
            borderRadius: 6,
            overflow: 'hidden',
            cursor: 'pointer',
            background: 'transparent',
            transition: 'border-color 0.15s',
          }}
        >
          {/* Preview swatch */}
          <div style={{
            display: 'flex',
            gap: 3,
            padding: '8px 8px 4px',
            backgroundColor: t.preview.bg,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 3,
              backgroundColor: t.preview.accent,
            }} />
            <div style={{
              width: 20, height: 20, borderRadius: 3,
              backgroundColor: t.preview.text,
              opacity: 0.6,
            }} />
            <div style={{
              width: 20, height: 20, borderRadius: 3,
              backgroundColor: t.preview.bg === '#080808' || t.preview.bg === '#1e2127' || t.preview.bg === '#21222c'
                ? '#2e2e2e' : '#e8ecf0',
            }} />
          </div>
          {/* Label */}
          <div style={{
            padding: '6px 8px',
            backgroundColor: t.preview.bg,
            borderTop: `1px solid ${t.preview.bg === '#080808' ? '#222' : t.preview.bg === '#f6f8fa' || t.preview.bg === '#fdf6e3' || t.preview.bg === '#FFFFFF' ? '#ddd' : '#333'}`,
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: theme === id ? 700 : 500,
              color: t.preview.text,
              fontFamily: 'IBM Plex Sans, sans-serif',
              textAlign: 'center',
            }}>
              {t.name}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
