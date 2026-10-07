const { app, BrowserWindow } = require('electron')
const path = require('path')
const { registerIpcHandlers } = require('./ipc')

// Задаётся только скриптом `npm run dev`. В обычном запуске и в собранном .exe
// загружается статика из dist/.
const devServerUrl = process.env.VITE_DEV_SERVER_URL

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1200,
        height: 760,
        minWidth: 760,
        minHeight: 480,
        backgroundColor: '#1e1f26',
        title: 'JsonPretty',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    })

    win.once('ready-to-show', () => win.show())
    win.setMenuBarVisibility(false)

    if (devServerUrl) {
        win.loadURL(devServerUrl)
        win.webContents.openDevTools({ mode: 'detach' })
    } else {
        win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    }

    return win
}

app.whenReady().then(() => {
    registerIpcHandlers()

    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
