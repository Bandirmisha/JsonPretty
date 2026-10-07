export {}

declare global {
    interface Window {
        api?: {
            platform: string
            writeClipboard: (text: string) => Promise<boolean>
            readClipboard: () => Promise<string>
        }
    }
}
