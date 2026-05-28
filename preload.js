const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Dialogs
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  processPaths: (paths) => ipcRenderer.invoke('process-paths', paths),

  // Hardware CD/DVD burner
  detectDrives: () => ipcRenderer.invoke('detect-optical-drives'),
  ejectDrive: (driveLetter) => ipcRenderer.invoke('eject-optical-drive', driveLetter),
  eraseDrive: (driveLetter) => ipcRenderer.invoke('erase-optical-drive', driveLetter),
  startOpticalBurn: (config) => ipcRenderer.invoke('start-optical-burn', config),
  onBurnLog: (callback) => ipcRenderer.on('burn-log', (event, data) => callback(data)),
  onBurnComplete: (callback) => ipcRenderer.on('burn-complete', (event, data) => callback(data)),
  
  // Cloner & Ripper
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  startOpticalRip: (config) => ipcRenderer.invoke('start-optical-rip', config),
  onRipLog: (callback) => ipcRenderer.on('rip-log', (event, data) => callback(data)),
  onRipComplete: (callback) => ipcRenderer.on('rip-complete', (event, data) => callback(data)),
  
  // Next-Gen Suite / Utilities
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  onWindowStateChange: (callback) => ipcRenderer.on('window-state', (event, data) => callback(data))
});
