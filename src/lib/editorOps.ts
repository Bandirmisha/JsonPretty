/** Отступ в поле ввода — два пробела, как в шаблоне группировки JSON. */
export const INDENT = '  '

export type Ctx = {
    value: string
    selectionStart: number
    selectionEnd: number
}

/**
 * Правка описывается как «заменить диапазон [start, end) на text и поставить каретку».
 * Так её можно применить одной операцией — она попадёт в нативный undo textarea.
 */
export type Edit = {
    start: number
    end: number
    text: string
    selectionStart: number
    selectionEnd: number
}

const lineStart = (value: string, pos: number): number => value.lastIndexOf('\n', pos - 1) + 1

const lineEnd = (value: string, pos: number): number => {
    const index = value.indexOf('\n', pos)
    return index === -1 ? value.length : index
}

/** Tab: вставка отступа, либо сдвиг всех строк выделения вправо. */
export function indentEdit(ctx: Ctx): Edit {
    const { value, selectionStart, selectionEnd } = ctx

    if (selectionStart === selectionEnd) {
        return {
            start: selectionStart,
            end: selectionEnd,
            text: INDENT,
            selectionStart: selectionStart + INDENT.length,
            selectionEnd: selectionStart + INDENT.length
        }
    }

    const from = lineStart(value, selectionStart)
    const to = lineEnd(value, selectionEnd)
    const text = value
        .slice(from, to)
        .split('\n')
        .map((line) => INDENT + line)
        .join('\n')

    return { start: from, end: to, text, selectionStart: from, selectionEnd: from + text.length }
}

/** Shift+Tab: снять до одного отступа с каждой строки выделения (или с текущей строки). */
export function dedentEdit(ctx: Ctx): Edit | null {
    const { value, selectionStart, selectionEnd } = ctx

    // Каретка без выделения — убираем отступ прямо перед ней
    if (selectionStart === selectionEnd) {
        const from = lineStart(value, selectionStart)
        const tail = value.slice(from, selectionStart).match(/[ \t]+$/)
        if (!tail) return null

        const remove = Math.min(tail[0].length, INDENT.length)
        const start = selectionStart - remove
        return { start, end: selectionStart, text: '', selectionStart: start, selectionEnd: start }
    }

    const from = lineStart(value, selectionStart)
    const to = lineEnd(value, selectionEnd)

    const lines = value.slice(from, to).split('\n')
    let removedAny = false

    const stripped = lines.map((line) => {
        if (line.startsWith(INDENT)) {
            removedAny = true
            return line.slice(INDENT.length)
        }
        const match = line.match(/^[ \t]+/)
        if (match) {
            removedAny = true
            return line.slice(match[0].length)
        }
        return line
    })

    if (!removedAny) return null

    const text = stripped.join('\n')
    return { start: from, end: to, text, selectionStart: from, selectionEnd: from + text.length }
}

/**
 * Enter: новая строка с сохранением отступа.
 * Если строка кончается на `{` или `[`, отступ увеличивается, а при готовой
 * закрывающей скобке сразу разворачивается блок:
 *   {↵  |↵}
 */
export function newlineEdit(ctx: Ctx): Edit {
    const { value, selectionStart, selectionEnd } = ctx
    const line = value.slice(lineStart(value, selectionStart), selectionStart)
    const baseIndent = (line.match(/^[ \t]*/) ?? [''])[0]

    const prevChar = value[selectionStart - 1]
    const nextChar = value[selectionStart]
    const collapsing = selectionStart === selectionEnd

    if (collapsing && (prevChar === '{' || prevChar === '[')) {
        const inner = baseIndent + INDENT
        const closer = prevChar === '{' ? '}' : ']'

        if (nextChar === closer) {
            const text = `\n${inner}\n${baseIndent}`
            const caret = selectionStart + 1 + inner.length
            return { start: selectionStart, end: selectionEnd, text, selectionStart: caret, selectionEnd: caret }
        }

        const text = `\n${inner}`
        const caret = selectionStart + text.length
        return { start: selectionStart, end: selectionEnd, text, selectionStart: caret, selectionEnd: caret }
    }

    const text = `\n${baseIndent}`
    const caret = selectionStart + text.length
    return { start: selectionStart, end: selectionEnd, text, selectionStart: caret, selectionEnd: caret }
}

const PAIRS: Record<string, string> = { '"': '"', '{': '}', '[': ']' }
const CLOSERS = new Set(['"', '}', ']'])

/** Автозакрытие кавычек и скобок, оборачивание выделения, «перешагивание» через закрывающую. */
export function pairEdit(ctx: Ctx, char: string): Edit | null {
    const { value, selectionStart, selectionEnd } = ctx
    const hasSelection = selectionStart !== selectionEnd

    const closer = PAIRS[char]
    if (closer) {
        if (hasSelection) {
            const text = char + value.slice(selectionStart, selectionEnd) + closer
            return {
                start: selectionStart,
                end: selectionEnd,
                text,
                selectionStart: selectionStart + 1,
                selectionEnd: selectionEnd + 1
            }
        }

        if (value[selectionStart] === closer) {
            return {
                start: selectionStart,
                end: selectionStart,
                text: '',
                selectionStart: selectionStart + 1,
                selectionEnd: selectionStart + 1
            }
        }

        return {
            start: selectionStart,
            end: selectionStart,
            text: char + closer,
            selectionStart: selectionStart + 1,
            selectionEnd: selectionStart + 1
        }
    }

    if (!hasSelection && CLOSERS.has(char) && value[selectionStart] === char) {
        return {
            start: selectionStart,
            end: selectionStart,
            text: '',
            selectionStart: selectionStart + 1,
            selectionEnd: selectionStart + 1
        }
    }

    return null
}

/**
 * Backspace: стирает всю последовательность пробелов и табов перед кареткой,
 * но не уходит за начало строки. Пустая пара символов имеет приоритет (см. backspacePairEdit).
 */
export function backspaceIndentEdit(ctx: Ctx): Edit | null {
    const { value, selectionStart, selectionEnd } = ctx
    if (selectionStart !== selectionEnd) return null

    const from = lineStart(value, selectionStart)
    const run = value.slice(from, selectionStart).match(/[ \t]+$/)
    if (!run) return null

    const start = selectionStart - run[0].length
    return { start, end: selectionStart, text: '', selectionStart: start, selectionEnd: start }
}

/**
 * Ctrl+X без выделения: вырезается вся строка, на которой стоит каретка.
 * Вместе со строкой забирается и перевод строки, чтобы не оставалось пустой строки.
 */
export function cutLineEdit(ctx: Ctx): { edit: Edit; text: string } | null {
    const { value, selectionStart, selectionEnd } = ctx
    if (selectionStart !== selectionEnd) return null

    let start = lineStart(value, selectionStart)
    let end = lineEnd(value, selectionStart)

    if (value[end] === '\n') end += 1
    else if (start > 0) start -= 1

    if (start === end) return null

    return {
        edit: { start, end, text: '', selectionStart: start, selectionEnd: start },
        text: value.slice(start, end)
    }
}

/** Backspace между парой символов удаляет её целиком. */
export function backspacePairEdit(ctx: Ctx): Edit | null {
    const { value, selectionStart, selectionEnd } = ctx
    if (selectionStart !== selectionEnd || selectionStart === 0) return null

    const prev = value[selectionStart - 1]
    const next = value[selectionStart]
    const isPair =
        (prev === '"' && next === '"') || (prev === '{' && next === '}') || (prev === '[' && next === ']')

    if (!isPair) return null

    return {
        start: selectionStart - 1,
        end: selectionStart + 1,
        text: '',
        selectionStart: selectionStart - 1,
        selectionEnd: selectionStart - 1
    }
}
