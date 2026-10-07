const { clipboard, ipcMain, BrowserWindow } = require('electron')

/** Окно ищем от отправителя: хендлеры не зависят от того, кто создал окно (приложение или тест) */
function senderWindow(event) {
    return BrowserWindow.fromWebContents(event.sender)
}

/**
 * IPC-хендлеры главного процесса. Вынесены отдельно, чтобы смоук-тест
 * использовал ровно тот же набор, что и приложение.
 *
 * В Electron 44 clipboard.writeText/readText возвращают Promise,
 * поэтому handler'ы тоже async — иначе renderer получит ответ
 * до фактической записи в системный буфер.
 */
function registerIpcHandlers() {
    // Буфер обмена берём из Electron — под file:// navigator.clipboard не гарантирован
    ipcMain.handle('clipboard:write', async (_event, text) => {
        await clipboard.writeText(String(text ?? ''))
        return true
    })

    ipcMain.handle('clipboard:read', () => clipboard.readText())

    // Управление окном из собственной полосы заголовка (окно создаётся с frame: false).
    // Минимум/разворот/закрытие — события без ответа, это действия, а не запросы.
    ipcMain.on('window:minimize', (event) => senderWindow(event)?.minimize())

    ipcMain.on('window:toggle-maximize', (event) => {
        const win = senderWindow(event)
        if (!win) return
        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
    })

    ipcMain.on('window:close', (event) => senderWindow(event)?.close())

    ipcMain.handle('window:is-maximized', (event) => senderWindow(event)?.isMaximized() ?? false)
}

/**
 * Окно может развернуться и помимо нашей кнопки (двойной клик по полосе, Win+стрелка,
 * перетаскивание к краю экрана), поэтому о состоянии сообщает сам главный процесс.
 */
function watchWindowState(win) {
    const send = () => {
        if (!win.isDestroyed()) win.webContents.send('window:maximized-changed', win.isMaximized())
    }

    win.on('maximize', send)
    win.on('unmaximize', send)
}

module.exports = { registerIpcHandlers, watchWindowState }
