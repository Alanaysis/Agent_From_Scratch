import { contextBridge, ipcRenderer } from "electron";

export interface IpcApi {
  invoke: (channel: string, data?: unknown) => Promise<unknown>;
  on: (channel: string, listener: (...args: unknown[]) => void) => void;
  off: (channel: string, listener: (...args: unknown[]) => void) => void;
}

const api: IpcApi = {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  on: (channel, listener) => {
    ipcRenderer.on(channel, (_event, ...args) => listener(...args));
  },
  off: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);