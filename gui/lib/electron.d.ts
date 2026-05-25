interface ElectronAPI {
  invoke: (channel: string, data: unknown) => Promise<unknown>
  on?: (channel: string, listener: (...args: unknown[]) => void) => void
  off?: (channel: string, listener: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}