import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveFileDialog: (options: { title?: string; defaultPath?: string; filters?: any[] }) =>
    ipcRenderer.invoke('dialog:saveFile', options),
  openFileDialog: (options: { title?: string; filters?: any[] }) =>
    ipcRenderer.invoke('dialog:openFile', options),
  writeFile: (filePath: string, content: string | Uint8Array) =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),
  readFile: (filePath: string) =>
    ipcRenderer.invoke('fs:readFile', filePath),
  geminiRequest: (urlOrModel: string, options?: any) =>
    ipcRenderer.invoke('api:geminiRequest', urlOrModel, options),
  setGeminiKey: (key: string) =>
    ipcRenderer.invoke('secrets:setGeminiKey', key),
  hasGeminiKey: () =>
    ipcRenderer.invoke('secrets:hasGeminiKey'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  isDesktop: true
});
