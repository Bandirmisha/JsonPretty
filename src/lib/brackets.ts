const OPEN: Record<string, string> = { '{': '}', '[': ']' }
const CLOSE: Record<string, string> = { '}': '{', ']': '[' }

/** Позиция внутри строкового литерала (учитывает экранирование). */
function isInsideString(text: string, pos: number): boolean {
    let inString = false

    for (let i = 0; i < pos; i++) {
        const char = text[i]
        if (inString) {
            if (char === '\\') i++
            else if (char === '"') inString = false
        } else if (char === '"') {
            inString = true
        }
    }

    return inString
}

function scanForward(text: string, from: number, open: string, close: string): number {
    let depth = 0
    let inString = false

    for (let i = from; i < text.length; i++) {
        const char = text[i]

        if (inString) {
            if (char === '\\') i++
            else if (char === '"') inString = false
            continue
        }

        if (char === '"') {
            inString = true
            continue
        }

        if (char === open) depth++
        else if (char === close) {
            depth--
            if (depth === 0) return i
        }
    }

    return -1
}

function scanBackward(text: string, from: number, close: string, open: string): number {
    let depth = 0
    let inString = false

    for (let i = from; i >= 0; i--) {
        const char = text[i]

        if (inString) {
            if (char === '"' && text[i - 1] !== '\\') inString = false
            continue
        }

        if (char === '"' && text[i - 1] !== '\\') {
            inString = true
            continue
        }

        if (char === close) depth++
        else if (char === open) {
            depth--
            if (depth === 0) return i
        }
    }

    return -1
}

/**
 * Пара скобок рядом с кареткой: проверяем символ справа от каретки и слева от неё.
 * Скобки внутри строк не учитываются.
 */
export function bracketMatchAt(text: string, caret: number): { open: number; close: number } | null {
    for (const pos of [caret, caret - 1]) {
        if (pos < 0 || pos >= text.length) continue

        const char = text[pos]
        if (!OPEN[char] && !CLOSE[char]) continue
        if (isInsideString(text, pos)) continue

        if (OPEN[char]) {
            const close = scanForward(text, pos, char, OPEN[char])
            if (close !== -1) return { open: pos, close }
        } else {
            const open = scanBackward(text, pos, char, CLOSE[char])
            if (open !== -1) return { open, close: pos }
        }
    }

    return null
}
