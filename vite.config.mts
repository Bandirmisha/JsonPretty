import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'"
].join('; ')

/**
 * CSP добавляем только в прод-сборку: в dev Vite вставляет inline-скрипты
 * (react-refresh preamble) и держит websocket для HMR — строгая политика их сломает.
 */
const prodCsp = (): Plugin => ({
    name: 'jsonpretty-prod-csp',
    apply: 'build',
    transformIndexHtml(html) {
        return html.replace(
            '</head>',
            `    <meta http-equiv="Content-Security-Policy" content="${CSP}">\n</head>`
        )
    }
})

// base: './' — обязательно, иначе собранные ассеты не найдутся при загрузке по file://
export default defineConfig({
    plugins: [react(), prodCsp()],
    base: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false
    },
    server: {
        port: 5173,
        strictPort: true
    }
})
