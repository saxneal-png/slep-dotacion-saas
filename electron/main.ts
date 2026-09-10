import { app, BrowserWindow, ipcMain, dialog, net } from 'electron';
import path from 'path';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'Consolidador de Dotación Docente - SLEP Valle Diguillín',
    backgroundColor: '#002B49',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.removeMenu();

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -----------------------------------------------------------------------------
// IPC Handlers: Diálogos y Sistema de Archivos
// -----------------------------------------------------------------------------

ipcMain.handle('dialog:saveFile', async (_, options) => {
  if (!mainWindow) return null;
  const res = await dialog.showSaveDialog(mainWindow, options);
  return res.canceled ? null : res.filePath;
});

ipcMain.handle('dialog:openFile', async (_, options) => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, options);
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string | Uint8Array) => {
  try {
    const buffer = Buffer.isBuffer(content) 
      ? content 
      : typeof content === 'string' 
        ? Buffer.from(content, 'utf-8') 
        : Buffer.from(content);
    await fs.promises.writeFile(filePath, buffer);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, data: content };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.handle('api:geminiRequest', async (_, url: string, options?: any) => {
  try {
    const fetchOptions: any = {
      method: options?.method || 'GET',
    };
    if (options?.headers) {
      fetchOptions.headers = options.headers;
    }
    if (options?.body) {
      fetchOptions.body = options.body;
    }

    const resp = await net.fetch(url, fetchOptions);
    const data = await resp.text();
    return {
      ok: resp.ok,
      status: resp.status,
      data
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: JSON.stringify({ error: { message: err?.message || 'Error de conexión de red' } }),
      error: err?.message
    };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
