import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#0a0e14',
    title: 'Wafer Inspection AI Copilot',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle('workflow:getState', () => {
  return { currentStep: 'roiGeneration' };
});

ipcMain.handle('workflow:transition', (_event, step: string) => {
  console.log('[IPC] Workflow transition to:', step);
  return { success: true, step };
});

ipcMain.handle('copilot:sendMessage', (_event, message: string) => {
  console.log('[IPC] Copilot message:', message);
  return { response: `Acknowledged: ${message}` };
});

ipcMain.handle('copilot:applySuggestion', (_event, id: string) => {
  console.log('[IPC] Apply suggestion:', id);
  return { success: true };
});

ipcMain.handle('visualization:getData', () => {
  return { waferId: 'WF-2024-001', diameter: 300 };
});
