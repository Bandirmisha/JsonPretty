const { clipboard, ipcMain } = require('electron')

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
}

module.exports = { registerIpcHandlers }
