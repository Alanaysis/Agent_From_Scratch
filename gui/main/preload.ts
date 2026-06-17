import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  workflow: {
    getState: () => ipcRenderer.invoke('workflow:getState'),
    transition: (step: string) => ipcRenderer.invoke('workflow:transition', step),
  },
  copilot: {
    sendMessage: (message: string) => ipcRenderer.invoke('copilot:sendMessage', message),
    applySuggestion: (id: string) => ipcRenderer.invoke('copilot:applySuggestion', id),
  },
  visualization: {
    getData: () => ipcRenderer.invoke('visualization:getData'),
  },
});
