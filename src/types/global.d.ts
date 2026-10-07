export {}

declare global {
    interface Window {
        api?: {
            platform: string
            writeClipboard: (text: string) => Promise<boolean>
            readClipboard: () => Promise<string>
            windowControls: {
                minimize: () => void
                toggleMaximize: () => void
                close: () => void
                isMaximized: () => Promise<boolean>
                onMaximizedChange: (callback: (maximized: boolean) => void) => void
            }
        }
    }
}
