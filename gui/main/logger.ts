import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function getLogDir(): string {
  try {
    const { app } = require('electron')
    return join(app.getPath('userData'), 'logs')
  } catch {
    return join(process.cwd(), 'logs')
  }
}

let _logFile: string | null = null

function getLogFile(): string {
  if (!_logFile) {
    const logDir = getLogDir()
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }
    _logFile = join(logDir, `irg-${new Date().toISOString().split('T')[0]}.log`)
  }
  return _logFile
}

export function log(level: 'INFO' | 'ERROR' | 'DEBUG', category: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString()
  const dataStr = data ? ` ${typeof data === 'object' ? JSON.stringify(data) : data}` : ''
  const logLine = `[${timestamp}] [${level}] [${category}] ${message}${dataStr}\n`

  try {
    appendFileSync(getLogFile(), logLine)
  } catch (e) {
    // Can't write log
  }

  if (level === 'ERROR') {
    console.error(`[${category}] ${message}`, data || '')
  } else if (level === 'DEBUG') {
    console.debug(`[${category}] ${message}`, data || '')
  } else {
    console.log(`[${category}] ${message}`, data || '')
  }
}

export function getLogPath(): string {
  return getLogFile()
}