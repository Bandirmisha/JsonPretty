/**
 * Запись в буфер обмена.
 *
 * Сначала пробуем Electron IPC (надёжно работает под file://),
 * затем — navigator.clipboard как запасной вариант.
 */
export async function writeClipboard(text: string): Promise<void> {
    const attempts: Array<[string, () => Promise<unknown>]> = [
        ['Electron IPC', () => window.api!.writeClipboard(text)],
        ['navigator.clipboard', () => navigator.clipboard.writeText(text)]
    ]

    const errors: string[] = []

    for (const [name, write] of attempts) {
        try {
            await write()
            return
        } catch (error) {
            errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    throw new Error(errors.join('; '))
}
