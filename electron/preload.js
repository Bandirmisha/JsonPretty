const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
    platform: process.platform,
    writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
    readClipboard: () => ipcRenderer.invoke('clipboard:read')
})
