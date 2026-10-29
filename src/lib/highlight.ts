export type TokenKind = 'j-key' | 'j-str' | 'j-bool' | 'j-null' | 'j-num' | 'j-punct' | 'j-comment'

export type Token = {
    start: number
    end: number
    kind: TokenKind
}

/**
 * Порядок альтернатив важен:
 *   1 — ключ объекта (строка, за которой идёт `:`) — двоеточие НЕ съедаем;
 *   2 — строковое значение;
 *   3 — true/false;
 *   4 — null;
 *   5 — число;
 *   6 — пунктуация { } [ ] , :
 */
const TOKEN_RE =
    /("(?:\\.|[^\\"])*")(?=\s*:)|("(?:\\.|[^\\"])*")|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|([{}[\],:])/g

/** Разбирает текст на токены с позициями. Работает и на невалидном JSON. */
export function tokenizeJson(text: string): Token[] {
    const tokens: Token[] = []
    let match: RegExpExecArray | null

    TOKEN_RE.lastIndex = 0

    while ((match = TOKEN_RE.exec(text)) !== null) {
        const [full, key, string, bool, punct] = match

        let kind: TokenKind = 'j-num'
        if (key) kind = 'j-key'
        else if (string) kind = 'j-str'
        else if (bool) kind = 'j-bool'
        else if (punct) kind = 'j-punct'
        else if (full === 'null') kind = 'j-null'

        tokens.push({ start: match.index, end: match.index + full.length, kind })
    }

    return tokens
}

/* ---------- Подсветка C# ----------
   Тот же набор классов j-*, что и у JSON, поэтому цвета берутся из переменных
   темы. Комментарии получили отдельный класс j-comment. */

const CSHARP_KEYWORDS = new Set([
    'abstract', 'add', 'as', 'async', 'await', 'base', 'bool', 'break', 'byte',
    'case', 'catch', 'char', 'checked', 'class', 'const', 'continue', 'decimal',
    'default', 'delegate', 'do', 'double', 'dynamic', 'else', 'enum', 'event',
    'explicit', 'extern', 'false', 'file', 'finally', 'fixed', 'float', 'for',
    'foreach', 'get', 'global', 'goto', 'if', 'implicit', 'in', 'init', 'int',
    'interface', 'internal', 'is', 'lock', 'long', 'nameof', 'namespace', 'new',
    'not', 'null', 'object', 'operator', 'out', 'override', 'params', 'partial',
    'private', 'protected', 'public', 'readonly', 'record', 'ref', 'remove',
    'required', 'return', 'sbyte', 'scoped', 'sealed', 'set', 'short', 'sizeof',
    'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true',
    'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using',
    'var', 'virtual', 'void', 'volatile', 'when', 'where', 'while', 'with', 'yield'
])

/** Разбирает C# на токены для подсветки. Невалидный код не должен ломать разбор. */
export function tokenizeCSharp(text: string): Token[] {
    const tokens: Token[] = []
    const n = text.length
    let i = 0

    const push = (start: number, end: number, kind: TokenKind) => {
        if (end > start) tokens.push({ start, end, kind })
    }

    while (i < n) {
        const ch = text[i]

        if (/\s/.test(ch)) {
            i++
            continue
        }

        // Комментарии
        if (ch === '/' && text[i + 1] === '/') {
            const start = i
            i += 2
            while (i < n && text[i] !== '\n') i++
            push(start, i, 'j-comment')
            continue
        }
        if (ch === '/' && text[i + 1] === '*') {
            const start = i
            i += 2
            while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++
            i = Math.min(n, i + 2)
            push(start, i, 'j-comment')
            continue
        }

        // Директивы препроцессора
        if (ch === '#' && (i === 0 || text[i - 1] === '\n')) {
            const start = i
            while (i < n && text[i] !== '\n') i++
            push(start, i, 'j-comment')
            continue
        }

        // Строки: обычные, verbatim @"", интерполированные, raw """..."""
        let prefixEnd = i
        while (prefixEnd < n && (text[prefixEnd] === '@' || text[prefixEnd] === '$')) prefixEnd++
        if (text[prefixEnd] === '"') {
            const start = i
            const verbatim = text.slice(i, prefixEnd).includes('@')
            let quotes = 0
            while (text[prefixEnd + quotes] === '"') quotes++

            let end: number
            if (quotes >= 3) {
                const openEnd = prefixEnd + quotes
                let k = openEnd
                while (k < n) {
                    if (text[k] !== '"') {
                        k++
                        continue
                    }
                    let run = 0
                    while (text[k + run] === '"') run++
                    if (run >= quotes) {
                        k += run
                        break
                    }
                    k += run
                }
                end = k
            } else {
                let k = prefixEnd + 1
                while (k < n) {
                    if (verbatim) {
                        if (text[k] === '"') {
                            if (text[k + 1] === '"') {
                                k += 2
                                continue
                            }
                            k++
                            break
                        }
                        k++
                    } else {
                        if (text[k] === '\\') {
                            k += 2
                            continue
                        }
                        if (text[k] === '"') {
                            k++
                            break
                        }
                        k++
                    }
                }
                end = k
            }

            push(start, end, 'j-str')
            i = end
            continue
        }

        // Символьные литералы
        if (ch === "'") {
            const start = i
            let k = i + 1
            while (k < n) {
                if (text[k] === '\\') {
                    k += 2
                    continue
                }
                if (text[k] === "'") {
                    k++
                    break
                }
                k++
            }
            push(start, k, 'j-str')
            i = k
            continue
        }

        // Идентификаторы: ключевые слова синие, типы — цветом ключей JSON
        if (/[\p{L}_@]/u.test(ch)) {
            const start = i
            i++
            while (i < n && /[\p{L}\p{N}_]/u.test(text[i])) i++
            const word = text.slice(start, i)
            const bare = word.startsWith('@') ? word.slice(1) : word

            if (CSHARP_KEYWORDS.has(bare)) push(start, i, 'j-bool')
            else if (/^[A-Z]/.test(bare)) push(start, i, 'j-key')
            continue
        }

        // Числа
        if (/[0-9]/.test(ch)) {
            const start = i
            i++
            while (i < n && /[0-9a-fA-FxX._eE+\-]/.test(text[i])) {
                if ((text[i] === '+' || text[i] === '-') && !/[eE]/.test(text[i - 1])) break
                i++
            }
            while (i < n && /[uUlLfFdDmM]/.test(text[i])) i++
            push(start, i, 'j-num')
            continue
        }

        push(i, i + 1, 'j-punct')
        i++
    }

    return tokens
}
