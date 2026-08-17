const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pulseMenu', {
  action: (name) => ipcRenderer.send('menu-action', name),
});
