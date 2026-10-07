/**
 * Разбор входной строки «любого вида».
 *
 * Порядок попыток:
 *   1. обычный JSON (в т.ч. JSONL — несколько значений построчно);
 *   2. разворачивание JSON, завёрнутого в строку: "{\"a\":1}";
 *   3. «либеральный» JSON: одинарные кавычки, ключи без кавычек, висячие запятые;
 *   4. вырезание первого объекта/массива из произвольного текста.
 */

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export class JsonParseError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'JsonParseError'
    }
}

type ParseResult = { ok: true; value: unknown } | { ok: false; error: Error }

function tryParse(text: string): ParseResult {
    try {
        return { ok: true, value: JSON.parse(text) }
    } catch (error) {
        // JSONL: несколько значений, по одному на строку
        const lines = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)

        if (lines.length > 1) {
            try {
                return { ok: true, value: lines.map((line) => JSON.parse(line)) }
            } catch {
                /* не JSONL — возвращаем исходную ошибку */
            }
        }

        return { ok: false, error: error as Error }
    }
}

/** Если распарсилось в строку, внутри которой снова JSON — разворачиваем её. */
function unwrapJsonString(value: unknown, depth = 0): unknown {
    if (depth > 3 || typeof value !== 'string') return value

    const text = value.trim()
    if (!/^[{[]/.test(text)) return value

    const inner = tryParse(text)
    return inner.ok ? unwrapJsonString(inner.value, depth + 1) : value
}

/** 'одинарные кавычки', ключи без кавычек, висячие запятые -> валидный JSON. */
export function relaxJson(text: string): string {
    let out = ''
    let inString = false
    let quote = ''

    for (let i = 0; i < text.length; i++) {
        const ch = text[i]

        if (inString) {
            if (ch === '\\') {
                out += ch + (text[i + 1] ?? '')
                i++
                continue
            }
            if (ch === quote) {
                inString = false
                out += '"'
                continue
            }
            if (ch === '"') {
                out += '\\"'
                continue
            }
            out += ch
            continue
        }

        if (ch === '"' || ch === "'") {
            inString = true
            quote = ch
            out += '"'
            continue
        }

        out += ch
    }

    return out
        .replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3') // ключи без кавычек
        .replace(/,(\s*[}\]])/g, '$1') // висячие запятые
}

/** Вырезает первый сбалансированный {...} или [...] из произвольного текста. */
export function sliceFirstJson(text: string): string | null {
    const start = text.search(/[{[]/)
    if (start === -1) return null

    let depth = 0
    let inString = false
    let quote = ''

    for (let i = start; i < text.length; i++) {
        const ch = text[i]

        if (inString) {
            if (ch === '\\') {
                i++
                continue
            }
            if (ch === quote) inString = false
            continue
        }

        if (ch === '"' || ch === "'") {
            inString = true
            quote = ch
            continue
        }

        if (ch === '{' || ch === '[') {
            depth++
        } else if (ch === '}' || ch === ']') {
            depth--
            if (depth === 0) return text.slice(start, i + 1)
        }
    }

    return text.slice(start)
}

export function parseLoose(raw: string): JsonValue {
    const text = raw.trim()
    if (!text) throw new JsonParseError('Пустой ввод')

    const direct = tryParse(text)
    if (direct.ok) return unwrapJsonString(direct.value) as JsonValue

    const relaxed = tryParse(relaxJson(text))
    if (relaxed.ok) return relaxed.value as JsonValue

    const sliced = sliceFirstJson(text)
    if (sliced) {
        const slicedStrict = tryParse(sliced)
        if (slicedStrict.ok) return slicedStrict.value as JsonValue

        const slicedRelaxed = tryParse(relaxJson(sliced))
        if (slicedRelaxed.ok) return slicedRelaxed.value as JsonValue
    }

    throw new JsonParseError(direct.error.message)
}

export function stringifyJson(value: JsonValue, indent: number): string {
    const text = JSON.stringify(value, null, indent)
    if (text === undefined) throw new JsonParseError('Значение не сериализуется в JSON')
    return text
}

export function describeValue(value: JsonValue): string {
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'array'
    return typeof value
}
