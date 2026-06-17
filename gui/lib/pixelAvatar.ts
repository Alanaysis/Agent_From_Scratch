// Deterministic pixel avatar generator from agent name
// Generates a 5x5 symmetric pixel grid with a unique color palette

const PALETTES = [
  ['#3b82f6', '#1d4ed8', '#60a5fa'], // blue
  ['#22c55e', '#15803d', '#4ade80'], // green
  ['#f59e0b', '#b45309', '#fbbf24'], // amber
  ['#ef4444', '#b91c1c', '#f87171'], // red
  ['#a855f7', '#7e22ce', '#c084fc'], // purple
  ['#ec4899', '#be185d', '#f472b6'], // pink
  ['#06b6d4', '#0e7490', '#22d3ee'], // cyan
  ['#f97316', '#c2410c', '#fb923c'], // orange
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

export interface PixelAvatarData {
  pixels: boolean[][]  // 5x5 grid, true = filled
  palette: string[]    // [primary, dark, light]
  bgColor: string
}

export function generatePixelAvatar(name: string, bgColor?: string): PixelAvatarData {
  const hash = hashString(name || 'default')
  const rand = seededRandom(hash)

  const palette = PALETTES[hash % PALETTES.length]
  const pixels: boolean[][] = []

  // Generate left half (3 columns), mirror for symmetry
  for (let y = 0; y < 5; y++) {
    const row: boolean[] = []
    for (let x = 0; x < 3; x++) {
      row.push(rand() > 0.45)
    }
    // Mirror: row[2] is center, row[3] = row[1], row[4] = row[0]
    pixels.push([row[0], row[1], row[2], row[1], row[0]])
  }

  return {
    pixels,
    palette,
    bgColor: bgColor || getThemeSurfaceColor(),
  }
}

/** Read the current theme's surface-0 color from CSS */
function getThemeSurfaceColor(): string {
  if (typeof window === 'undefined') return '#0a0a0a'
  const val = getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim()
  return val || '#0a0a0a'
}

export function pixelAvatarToSvg(avatar: PixelAvatarData, size: number = 32): string {
  const { pixels, palette, bgColor } = avatar
  const cellSize = size / 5
  const padding = 1

  let rects = ''
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (pixels[y][x]) {
        const color = (x + y) % 3 === 0 ? palette[1] : palette[0]
        rects += `<rect x="${x * cellSize + padding}" y="${y * cellSize + padding}" width="${cellSize - padding * 2}" height="${cellSize - padding * 2}" fill="${color}" rx="1"/>`
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bgColor}" rx="4"/>
    ${rects}
  </svg>`
}

export function pixelAvatarToDataUrl(name: string, size: number = 32, bgColor?: string): string {
  const avatar = generatePixelAvatar(name, bgColor)
  const svg = pixelAvatarToSvg(avatar, size)
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Generate a color for an agent based on its name (for status dots, borders, etc.)
export function getAgentColor(name: string): string {
  const hash = hashString(name || 'default')
  return PALETTES[hash % PALETTES.length][0]
}
