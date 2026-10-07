const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
    platform: process.platform,
    writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
    readClipboard: () => ipcRenderer.invoke('clipboard:read'),

    /**
     * Кнопки собственной полосы заголовка. Окно создаётся без системной рамки
     * (frame: false), поэтому сворачивать/разворачивать/закрывать его приходится
     * через главный процесс — из renderer'а это сделать нельзя.
     * onMaximizedChange не возвращает отписку: полоса заголовка монтируется один раз.
     */
    windowControls: {
        minimize: () => ipcRenderer.send('window:minimize'),
        toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
        close: () => ipcRenderer.send('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
        onMaximizedChange: (callback) => {
            ipcRenderer.on('window:maximized-changed', (_event, value) => callback(value))
        }
    }
})
