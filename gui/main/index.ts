import { app, BrowserWindow, shell } from "electron";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { registerSessionHandlers } from "./handlers/sessions";
import { registerChatHandlers } from "./handlers/chat";
import { registerConfigHandlers } from "./handlers/config";
import { registerTaskHandlers } from "./handlers/tasks";
import { registerExecutorHandlers } from "./handlers/executor";
import { registerAgentHandlers } from "./handlers/agents";
import { registerRecipeHandlers } from "./handlers/recipes";
import { registerPlanHandlers } from "./handlers/plans";
import { registerPmHandlers } from "./handlers/pm";
import { registerProposalHandlers } from "./handlers/proposals";
import { registerDocumentHandlers } from "./handlers/documents";
import { registerWorkflowHandlers } from "./handlers/workflows";
import { initIpcPush } from "./ipcPush";
import { startHttpServer } from "./httpServer";
import { log } from "./logger";

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

async function createWindow() {
  log('INFO', 'Main', 'Creating main window')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "IRG",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    log('INFO', 'Main', 'Loading dev URL: http://localhost:3001')
    await mainWindow.loadURL("http://localhost:3001");
  } else {
    const htmlPath = join(__dirname, "../../out/index.html");
    log('INFO', 'Main', `Loading production file: ${htmlPath}`)
    await mainWindow.loadFile(htmlPath);
  }

  initIpcPush(mainWindow)
  log('INFO', 'Main', 'Window loaded successfully')
}

function registerHandlers() {
  log('INFO', 'Main', 'Registering IPC handlers')
  registerSessionHandlers();
  registerChatHandlers();
  registerConfigHandlers();
  registerTaskHandlers();
  registerExecutorHandlers();
  registerAgentHandlers();
  registerRecipeHandlers();
  registerPlanHandlers();
  registerPmHandlers();
  registerProposalHandlers();
  registerDocumentHandlers();
  registerWorkflowHandlers();
  log('INFO', 'Main', 'All IPC handlers registered')
}

app.whenReady().then(() => {
  log('INFO', 'Main', 'App ready, starting initialization')

  try {
    registerHandlers();
    createWindow();

    // Start HTTP API server for non-Electron access (CORS enabled)
    const httpPort = parseInt(process.env.IRG_HTTP_PORT || '3002', 10);
    startHttpServer(httpPort);

    log('INFO', 'Main', 'Initialization complete')
  } catch (e) {
    log('ERROR', 'Main', 'Initialization failed', e)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  log('INFO', 'Main', 'All windows closed')
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (e) => {
  log('ERROR', 'Main', 'Uncaught exception', { message: e.message, stack: e.stack })
});

process.on('unhandledRejection', (e) => {
  log('ERROR', 'Main', 'Unhandled rejection', e)
});