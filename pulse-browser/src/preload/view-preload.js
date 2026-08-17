const { contextBridge, ipcRenderer } = require('electron');

// Exposed only to internal pulse:// pages loaded via loadFile (file:// origin).
// External websites still get a sandbox but this API is harmless if unused.
contextBridge.exposeInMainWorld('pulsePage', {
  navigate: (url) => ipcRenderer.send('internal-navigate', url),
  openTab: (url) => ipcRenderer.send('internal-open-tab', url),
  getHistory: (opts) => ipcRenderer.invoke('get-history', opts),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  removeBookmark: (id) => ipcRenderer.invoke('remove-bookmark', id),
  addBookmark: (entry) => ipcRenderer.invoke('add-bookmark', entry),
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  clearDownloads: () => ipcRenderer.invoke('clear-downloads'),
  openDownload: (path) => ipcRenderer.invoke('open-download', path),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (patch) => ipcRenderer.invoke('update-settings', patch),
});
