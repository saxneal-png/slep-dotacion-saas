import { app, BrowserWindow, ipcMain, dialog, net, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
const authorizedReadPaths = new Set<string>();
const authorizedWritePaths = new Set<string>();

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.json', '.sqlite', '.db', '.csv', '.pdf']);

function getSecretFilePath(): string {
  return path.join(app.getPath('userData'), 'gemini_key.enc');
}

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
      sandbox: true,
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
// IPC Handlers: Diálogos y Sistema de Archivos con Validación de Rutas y Extensiones
// -----------------------------------------------------------------------------

ipcMain.handle('dialog:saveFile', async (_, options) => {
  if (!mainWindow) return null;
  const res = await dialog.showSaveDialog(mainWindow, options);
  if (res.canceled || !res.filePath) return null;
  const resolved = path.resolve(res.filePath);
  authorizedWritePaths.add(resolved);
  return resolved;
});

ipcMain.handle('dialog:openFile', async (_, options) => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, options);
  if (res.canceled || !res.filePaths.length) return null;
  const resolved = path.resolve(res.filePaths[0]);
  authorizedReadPaths.add(resolved);
  return resolved;
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string | Uint8Array) => {
  try {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Ruta de archivo inválida');
    }
    const resolved = path.resolve(filePath);
    if (!authorizedWritePaths.has(resolved)) {
      throw new Error('Operación bloqueada por seguridad: la ruta de destino no fue autorizada mediante un diálogo de guardado.');
    }
    const ext = path.extname(resolved).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Extensión de archivo no permitida: ${ext}. Extensiones válidas: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`);
    }

    const buffer = Buffer.isBuffer(content) 
      ? content 
      : typeof content === 'string' 
        ? Buffer.from(content, 'utf-8') 
        : Buffer.from(content);

    await fs.promises.writeFile(resolved, buffer);
    authorizedWritePaths.delete(resolved); // Token de un solo uso
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  try {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Ruta de archivo inválida');
    }
    const resolved = path.resolve(filePath);
    const appDir = path.resolve(app.getAppPath());
    const isAppAsset = resolved.startsWith(appDir);

    if (!authorizedReadPaths.has(resolved) && !isAppAsset) {
      throw new Error('Operación bloqueada por seguridad: la ruta de lectura no fue autorizada mediante un diálogo de apertura.');
    }
    const ext = path.extname(resolved).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Extensión de archivo no permitida: ${ext}`);
    }

    const content = await fs.promises.readFile(resolved, 'utf-8');
    return { success: true, data: content };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:getVersion', () => app.getVersion());

// -----------------------------------------------------------------------------
// IPC Handlers: Gestión Segura de Secretos con safeStorage (DPAPI / Keychain)
// -----------------------------------------------------------------------------

ipcMain.handle('secrets:setGeminiKey', async (_, plainKey: string) => {
  try {
    const trimmed = (plainKey || '').trim();
    const secretPath = getSecretFilePath();
    if (!trimmed) {
      if (fs.existsSync(secretPath)) {
        await fs.promises.rm(secretPath, { force: true });
      }
      return { success: true };
    }

    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(trimmed);
      await fs.promises.writeFile(secretPath, encrypted);
      return { success: true };
    } else {
      // Fallback base64 ofuscado si safeStorage no estuviese activo en el host
      const b64 = Buffer.from(trimmed, 'utf-8').toString('base64');
      await fs.promises.writeFile(secretPath, b64, 'utf-8');
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('secrets:hasGeminiKey', async () => {
  try {
    return fs.existsSync(getSecretFilePath());
  } catch (_) {
    return false;
  }
});

// -----------------------------------------------------------------------------
// IPC Handlers: Proxy Seguro Gemini (Prevención SSRF + Inyección de x-goog-api-key)
// -----------------------------------------------------------------------------

ipcMain.handle('api:geminiRequest', async (_, urlOrModel: string, options?: any) => {
  try {
    let model = urlOrModel;
    if (urlOrModel.startsWith('http://') || urlOrModel.startsWith('https://')) {
      const parsedUrl = new URL(urlOrModel);
      if (parsedUrl.hostname !== 'generativelanguage.googleapis.com') {
        throw new Error(`SSRF Bloqueado: Host no autorizado (${parsedUrl.hostname})`);
      }
      const modelMatch = parsedUrl.pathname.match(/\/models\/([a-zA-Z0-9._-]+):generateContent/);
      if (!modelMatch) {
        throw new Error(`SSRF Bloqueado: Ruta de API no permitida (${parsedUrl.pathname})`);
      }
      model = modelMatch[1];
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
      throw new Error(`Nombre de modelo inválido o potencialmente malicioso: ${model}`);
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    let apiKey = '';
    const secretPath = getSecretFilePath();
    if (fs.existsSync(secretPath)) {
      try {
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
          const encBuffer = await fs.promises.readFile(secretPath);
          apiKey = safeStorage.decryptString(encBuffer);
        } else {
          const b64 = await fs.promises.readFile(secretPath, 'utf-8');
          apiKey = Buffer.from(b64, 'base64').toString('utf-8');
        }
      } catch (err) {
        console.warn('Advertencia al recuperar API key de safeStorage:', err);
      }
    }

    if (!apiKey && options?.apiKey) {
      apiKey = options.apiKey;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    };

    if (apiKey) {
      headers['x-goog-api-key'] = apiKey; // Inyección segura en header, nunca en la URL
    }

    const fetchOptions: any = {
      method: options?.method || 'POST',
      headers,
    };
    if (options?.body) {
      fetchOptions.body = options.body;
    }

    const resp = await net.fetch(endpoint, fetchOptions);
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
