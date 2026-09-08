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
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  isDesktop: true
});
