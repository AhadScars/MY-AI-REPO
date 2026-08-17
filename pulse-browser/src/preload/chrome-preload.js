const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pulse', {
  getState: () => ipcRenderer.invoke('get-state'),
  setChromeHeight: (h) => ipcRenderer.invoke('chrome-height', h),
  createTab: (url) => ipcRenderer.invoke('create-tab', url),
  closeTab: (id) => ipcRenderer.invoke('close-tab', id),
  activateTab: (id) => ipcRenderer.invoke('activate-tab', id),
  navigate: (tabId, url) => ipcRenderer.invoke('navigate', { tabId, url }),
  goBack: (tabId) => ipcRenderer.invoke('go-back', tabId),
  goForward: (tabId) => ipcRenderer.invoke('go-forward', tabId),
  reload: (tabId, ignoreCache) => ipcRenderer.invoke('reload', { tabId, ignoreCache }),
  stop: (tabId) => ipcRenderer.invoke('stop', tabId),
  getHistory: (opts) => ipcRenderer.invoke('get-history', opts),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  addBookmark: (entry) => ipcRenderer.invoke('add-bookmark', entry),
  removeBookmark: (idOrUrl) => ipcRenderer.invoke('remove-bookmark', idOrUrl),
  toggleBookmark: (entry) => ipcRenderer.invoke('toggle-bookmark', entry),
  isBookmarked: (url) => ipcRenderer.invoke('is-bookmarked', url),
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  clearDownloads: () => ipcRenderer.invoke('clear-downloads'),
  openDownload: (path) => ipcRenderer.invoke('open-download', path),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (patch) => ipcRenderer.invoke('update-settings', patch),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  suggest: (query) => ipcRenderer.invoke('suggest', query),
  showAppMenu: (anchor) => ipcRenderer.invoke('show-app-menu', anchor),
  hideAppMenu: () => ipcRenderer.invoke('hide-app-menu'),
  onState: (cb) => {
    const handler = (_e, state) => cb(state);
    ipcRenderer.on('browser-state', handler);
    return () => ipcRenderer.removeListener('browser-state', handler);
  },
  onToast: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('toast', handler);
    return () => ipcRenderer.removeListener('toast', handler);
  },
  onFocusOmnibox: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('focus-omnibox', handler);
    return () => ipcRenderer.removeListener('focus-omnibox', handler);
  },
  onDownload: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('download-updated', handler);
    return () => ipcRenderer.removeListener('download-updated', handler);
  },
});
