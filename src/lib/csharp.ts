/**
 * Разбор C#-класса в заготовку JSON.
 *
 * Вход — не обязательно «чистое» объявление: можно вставить весь файл с using,
 * namespace, комментариями, атрибутами и несколькими классами. Лишнее пропускается,
 * а из верхнеуровневых классов выбирается корневой (тот, который не используется
 * как тип полей других классов; если такой не один — первый объявленный).
 *
 * Имена полей JSON берутся из [JsonProperty("имя")] (Newtonsoft.Json) и
 * [JsonPropertyName("имя")] (System.Text.Json). Если в классе есть хотя бы один
 * такой атрибут, в JSON попадают только помеченные им поля; если атрибутов нет —
 * все public-поля пишутся под своими именами. [JsonIgnore] исключает поле всегда.
 */

import type { JsonValue } from './parseLoose'

export class CSharpParseError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'CSharpParseError'
    }
}

/* ---------- Токенизатор ---------- */

type TokenKind = 'id' | 'string' | 'char' | 'number' | 'punct'

type Token = {
    value: string
    start: number
    end: number
    kind: TokenKind
}

const ID_START = /[\p{L}_@]/u
const ID_PART = /[\p{L}\p{N}_]/u

function tokenize(source: string): Token[] {
    const tokens: Token[] = []
    const n = source.length
    let i = 0

    while (i < n) {
        const ch = source[i]

        if (/\s/.test(ch)) {
            i++
            continue
        }

        // Комментарии
        if (ch === '/' && source[i + 1] === '/') {
            i += 2
            while (i < n && source[i] !== '\n') i++
            continue
        }
        if (ch === '/' && source[i + 1] === '*') {
            i += 2
            while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++
            i = Math.min(n, i + 2)
            continue
        }

        // Директивы препроцессора (#nullable, #region) — до конца строки
        if (ch === '#' && (i === 0 || source[i - 1] === '\n')) {
            while (i < n && source[i] !== '\n') i++
            continue
        }

        // Строки: обычные, verbatim @"", интерполированные, raw """..."""
        let prefixEnd = i
        while (prefixEnd < n && (source[prefixEnd] === '@' || source[prefixEnd] === '$')) prefixEnd++
        if (source[prefixEnd] === '"') {
            const prefix = source.slice(i, prefixEnd)
            const verbatim = prefix.includes('@')
            let quoteCount = 0
            while (source[prefixEnd + quoteCount] === '"') quoteCount++

            let end: number
            if (quoteCount >= 3) {
                // Raw string: закрывается таким же количеством кавычек
                const openEnd = prefixEnd + quoteCount
                let k = openEnd
                while (k < n) {
                    if (source[k] !== '"') {
                        k++
                        continue
                    }
                    let run = 0
                    while (source[k + run] === '"') run++
                    if (run >= quoteCount) {
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
                        if (source[k] === '"') {
                            if (source[k + 1] === '"') {
                                k += 2
                                continue
                            }
                            k++
                            break
                        }
                        k++
                    } else {
                        if (source[k] === '\\') {
                            k += 2
                            continue
                        }
                        if (source[k] === '"') {
                            k++
                            break
                        }
                        k++
                    }
                }
                end = k
            }

            tokens.push({ value: source.slice(i, end), start: i, end, kind: 'string' })
            i = end
            continue
        }

        // Символьные литералы
        if (ch === "'") {
            let k = i + 1
            while (k < n) {
                if (source[k] === '\\') {
                    k += 2
                    continue
                }
                if (source[k] === "'") {
                    k++
                    break
                }
                k++
            }
            tokens.push({ value: source.slice(i, k), start: i, end: k, kind: 'char' })
            i = k
            continue
        }

        // Идентификаторы (включая @class)
        if (ID_START.test(ch)) {
            let k = i + 1
            while (k < n && ID_PART.test(source[k])) k++
            tokens.push({ value: source.slice(i, k), start: i, end: k, kind: 'id' })
            i = k
            continue
        }

        // Числа
        if (/[0-9]/.test(ch)) {
            let k = i + 1
            while (k < n && /[0-9a-fA-FxX._eE+\-]/.test(source[k])) {
                // Знак после e/E — часть экспоненты, иначе это уже следующий оператор
                if ((source[k] === '+' || source[k] === '-') && !/[eE]/.test(source[k - 1])) break
                k++
            }
            while (k < n && /[uUlLfFdDmM]/.test(source[k])) k++
            tokens.push({ value: source.slice(i, k), start: i, end: k, kind: 'number' })
            i = k
            continue
        }

        // Операторы из двух символов
        const two = source.slice(i, i + 2)
        if (['=>', '::', '??', '==', '!=', '<=', '>=', '&&', '||'].includes(two)) {
            tokens.push({ value: two, start: i, end: i + 2, kind: 'punct' })
            i += 2
            continue
        }

        tokens.push({ value: ch, start: i, end: i + 1, kind: 'punct' })
        i++
    }

    return tokens
}

/* ---------- Вспомогательные функции над токенами ---------- */

/** Индекс парной скобки: openIndex указывает на открывающую. */
function matchPair(tokens: Token[], openIndex: number, open: string, close: string): number {
    let depth = 0
    for (let i = openIndex; i < tokens.length; i++) {
        if (tokens[i].value === open) depth++
        else if (tokens[i].value === close) {
            depth--
            if (depth === 0) return i
        }
    }
    return -1
}

type Depth = { round: number; square: number; angle: number; curly: number }

function isTop(depth: Depth): boolean {
    return depth.round === 0 && depth.square === 0 && depth.angle === 0 && depth.curly === 0
}

/** Делит токены по разделителю, не заглядывая внутрь скобок и generic-аргументов. */
function splitTopLevel(tokens: Token[], separator: string): Token[][] {
    const parts: Token[][] = []
    let current: Token[] = []
    const depth: Depth = { round: 0, square: 0, angle: 0, curly: 0 }

    for (const token of tokens) {
        const v = token.value
        if (v === '(') depth.round++
        else if (v === ')') depth.round--
        else if (v === '[') depth.square++
        else if (v === ']') depth.square--
        else if (v === '{') depth.curly++
        else if (v === '}') depth.curly--
        else if (v === '<') depth.angle++
        else if (v === '>') depth.angle = Math.max(0, depth.angle - 1)

        if (isTop(depth) && v === separator) {
            parts.push(current)
            current = []
            continue
        }
        current.push(token)
    }

    if (current.length > 0) parts.push(current)
    return parts
}

function cleanIdentifier(value: string): string {
    return value.startsWith('@') ? value.slice(1) : value
}

function stripAttributeSuffix(name: string): string {
    return name.endsWith('Attribute') ? name.slice(0, -'Attribute'.length) : name
}

function decodeStringLiteral(raw: string): string {
    let prefixEnd = 0
    while (raw[prefixEnd] === '@' || raw[prefixEnd] === '$') prefixEnd++

    const verbatim = raw.slice(0, prefixEnd).includes('@')
    const body = raw.slice(prefixEnd)

    let quoteCount = 0
    while (body[quoteCount] === '"') quoteCount++

    if (quoteCount >= 3) {
        return body.slice(quoteCount, body.length - quoteCount)
    }

    const text = body.slice(1, body.length - 1)
    if (verbatim) return text.replace(/""/g, '"')

    return text.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{1,4}|.)/g, (_match, escape: string) => {
        if (escape[0] === 'u' || escape[0] === 'x') {
            return String.fromCharCode(parseInt(escape.slice(1), 16))
        }
        switch (escape) {
            case 'n':
                return '\n'
            case 'r':
                return '\r'
            case 't':
                return '\t'
            case '0':
                return '\0'
            case '\\':
            case '"':
            case "'":
                return escape
            default:
                return escape
        }
    })
}

/* ---------- Атрибуты ---------- */

type AttributeInfo = {
    name: string
    strings: string[]
    named: Record<string, string>
}

function parseAttributes(tokens: Token[]): AttributeInfo[] {
    const result: AttributeInfo[] = []

    for (const part of splitTopLevel(tokens, ',')) {
        let i = 0
        // Цель атрибута: [property: JsonProperty("...")]
        if (part[0]?.kind === 'id' && part[1]?.value === ':') i = 2

        const nameParts: string[] = []
        while (i < part.length && part[i].value !== '(') {
            if (part[i].kind === 'id') nameParts.push(part[i].value)
            i++
        }
        if (nameParts.length === 0) continue

        const name = stripAttributeSuffix(cleanIdentifier(nameParts[nameParts.length - 1]))
        const strings: string[] = []
        const named: Record<string, string> = {}

        if (part[i]?.value === '(') {
            const close = matchPair(part, i, '(', ')')
            const args = part.slice(i + 1, close === -1 ? part.length : close)

            for (const arg of splitTopLevel(args, ',')) {
                // Именованный аргумент: PropertyName = "имя"
                if (arg[0]?.kind === 'id' && arg[1]?.value === '=') {
                    const value = arg.slice(2).find((token) => token.kind === 'string')
                    if (value) named[cleanIdentifier(arg[0].value)] = decodeStringLiteral(value.value)
                }
                for (const token of arg) {
                    if (token.kind === 'string') strings.push(decodeStringLiteral(token.value))
                }
            }
        }

        result.push({ name, strings, named })
    }

    return result
}

type JsonNameInfo = { present: boolean; name: string | null }
const NO_JSON_NAME: JsonNameInfo = { present: false, name: null }

function jsonNameOf(attributes: AttributeInfo[]): JsonNameInfo {
    for (const attribute of attributes) {
        if (attribute.name !== 'JsonProperty' && attribute.name !== 'JsonPropertyName') continue

        const explicit = attribute.named.PropertyName ?? attribute.named.Name ?? attribute.strings[0]
        return { present: true, name: explicit ?? null }
    }
    return NO_JSON_NAME
}

function isIgnored(attributes: AttributeInfo[]): boolean {
    return attributes.some((attribute) => attribute.name === 'JsonIgnore')
}

/* ---------- Типы ---------- */

type TypeRef = {
    /** Простое имя типа: List, Dictionary, int, MyDto */
    name: string
    args: TypeRef[]
    arrayDepth: number
    nullable: boolean
}

function parseTypeTokens(tokens: Token[]): TypeRef {
    let end = tokens.length

    // Снимаем с конца ? и [] в любом порядке: int?[], string[]?
    let nullable = false
    let arrayDepth = 0
    let changed = true
    while (changed && end > 0) {
        changed = false

        if (tokens[end - 1].value === '?') {
            nullable = true
            end--
            changed = true
            continue
        }

        if (tokens[end - 1].value === ']') {
            let depth = 0
            let open = -1
            for (let i = end - 1; i >= 0; i--) {
                if (tokens[i].value === ']') depth++
                else if (tokens[i].value === '[') {
                    depth--
                    if (depth === 0) {
                        open = i
                        break
                    }
                }
            }
            if (open >= 0 && tokens.slice(open + 1, end - 1).every((token) => token.value === ',')) {
                arrayDepth++
                end = open
                changed = true
            }
        }
    }

    let body = tokens.slice(0, end)

    // Кортеж: (int A, string B)
    if (body[0]?.value === '(') {
        const close = matchPair(body, 0, '(', ')')
        if (close === body.length - 1) {
            const inner = body.slice(1, -1)
            const args = splitTopLevel(inner, ',')
                .filter((part) => part.length > 0)
                .map(tupleElementType)
            return { name: 'ValueTuple', args, arrayDepth, nullable }
        }
    }

    let i = 0
    let name = ''
    while (i < body.length && body[i].value !== '<') {
        if (body[i].kind === 'id') name = cleanIdentifier(body[i].value)
        i++
    }

    let args: TypeRef[] = []
    if (body[i]?.value === '<') {
        const close = matchPair(body, i, '<', '>')
        const inner = body.slice(i + 1, close === -1 ? body.length : close)
        args = splitTopLevel(inner, ',')
            .filter((part) => part.length > 0)
            .map(parseTypeTokens)
    }

    return { name, args, arrayDepth, nullable }
}

/** Элемент кортежа может иметь имя: (int A, string B) -> тип без A/B. */
function tupleElementType(tokens: Token[]): TypeRef {
    let end = tokens.length
    const last = tokens[end - 1]
    if (last?.kind === 'id' && end >= 2) {
        const prev = tokens[end - 2]
        if (prev.kind === 'id' || prev.value === '>' || prev.value === ']' || prev.value === '?') {
            end--
        }
    }
    return parseTypeTokens(tokens.slice(0, end))
}

/* ---------- Модель класса ---------- */

type MemberInfo = {
    name: string
    type: TypeRef
    /** Имя из JsonProperty/JsonPropertyName; null — брать name */
    jsonName: string | null
    hasJsonAttr: boolean
    ignored: boolean
    isPublic: boolean
}

type ClassInfo = {
    name: string
    nested: boolean
    baseTypes: string[]
    members: MemberInfo[]
}

type Collected = {
    classes: Map<string, ClassInfo>
    order: ClassInfo[]
    enums: Set<string>
}

const TYPE_KEYWORDS = new Set(['class', 'struct', 'record', 'interface', 'enum'])

const MODIFIERS = new Set([
    'public', 'private', 'protected', 'internal',
    'static', 'const', 'readonly', 'required', 'virtual', 'override', 'abstract',
    'sealed', 'new', 'partial', 'unsafe', 'extern', 'volatile', 'async', 'event',
    'fixed', 'ref', 'scoped', 'file', 'implicit', 'explicit'
])

/** Похож ли набор токенов на объявление вложенного типа (class/struct/record/...). */
function isTypeDeclaration(tokens: Token[]): boolean {
    for (let i = 0; i < tokens.length; i++) {
        const value = tokens[i].value
        if (value === '(' || value === '=' || value === '=>') return false
        if (!TYPE_KEYWORDS.has(value)) continue
        if (tokens[i - 1]?.value === '.') continue

        const next = tokens[i + 1]
        if (next?.kind === 'id') return true
    }
    return false
}

function parseMemberSegment(segment: Token[], attributes: AttributeInfo[]): MemberInfo[] {
    // Отрезаем инициализатор и выражение: всё, что после = или =>
    let cut = segment.length
    const depth: Depth = { round: 0, square: 0, angle: 0, curly: 0 }
    for (let i = 0; i < segment.length; i++) {
        const v = segment[i].value
        if (v === '(') depth.round++
        else if (v === ')') depth.round--
        else if (v === '[') depth.square++
        else if (v === ']') depth.square--
        else if (v === '<') depth.angle++
        else if (v === '>') depth.angle = Math.max(0, depth.angle - 1)
        else if (isTop(depth) && (v === '=' || v === '=>')) {
            cut = i
            break
        }
    }

    let decl = segment.slice(0, cut)
    if (decl.length === 0) return []

    let isPublic = false
    let isStatic = false
    let isConst = false
    let isEvent = false

    let start = 0
    while (start < decl.length) {
        const value = decl[start].value
        if (value === 'public') isPublic = true
        else if (value === 'static') isStatic = true
        else if (value === 'const') isConst = true
        else if (value === 'event') isEvent = true
        else if (!MODIFIERS.has(value)) break
        start++
    }
    decl = decl.slice(start)

    if (decl.length === 0 || isStatic || isConst || isEvent) return []

    // Методы, конструкторы, делегаты, операторы и индексаторы нам не нужны
    const hasThis = decl.some((token) => token.value === 'this')
    if (hasThis) return []
    if (decl.some((token) => token.value === 'delegate' || token.value === 'operator')) return []

    // Метод отличается от поля с типом-кортежем наличием скобок верхнего уровня
    let parenDepth = 0
    for (let i = 0; i < decl.length; i++) {
        if (decl[i].value !== '(') {
            if (decl[i].value === ')') parenDepth = Math.max(0, parenDepth - 1)
            continue
        }
        if (parenDepth === 0 && i > 0) return []
        parenDepth++
    }

    const parts = splitTopLevel(decl, ',')
    const result: MemberInfo[] = []
    let sharedType: Token[] | null = null

    for (let p = 0; p < parts.length; p++) {
        const part = parts[p]
        if (part.length === 0) continue

        let nameIndex = -1
        for (let i = part.length - 1; i >= 0; i--) {
            if (part[i].kind === 'id') {
                nameIndex = i
                break
            }
        }
        if (nameIndex === -1) continue

        const name = cleanIdentifier(part[nameIndex].value)
        if (!name) continue

        let typeTokens = part.slice(0, nameIndex)
        if (typeTokens.length === 0) {
            if (p === 0 || !sharedType) continue
            typeTokens = sharedType
        } else if (p === 0) {
            sharedType = typeTokens
        }

        const type = parseTypeTokens(typeTokens)
        if (!type.name) continue

        const json = jsonNameOf(attributes)
        const ignored = isIgnored(attributes)
        if (!isPublic && !json.present) continue

        result.push({
            name,
            type,
            jsonName: json.name,
            hasJsonAttr: json.present,
            ignored,
            isPublic
        })
    }

    return result
}

/** Поля тела класса: сканируем до ; или до блока { ... }. */
function parseMembers(tokens: Token[], from: number, to: number): MemberInfo[] {
    const members: MemberInfo[] = []
    let pendingAttributes: AttributeInfo[] = []
    let i = from

    while (i < to) {
        if (tokens[i].value === '[') {
            const close = matchPair(tokens, i, '[', ']')
            if (close === -1 || close >= to) break
            pendingAttributes.push(...parseAttributes(tokens.slice(i + 1, close)))
            i = close + 1
            continue
        }

        if (tokens[i].value === ';') {
            pendingAttributes = []
            i++
            continue
        }

        const segment: Token[] = []
        let round = 0
        let square = 0
        let containsParen = false
        let containsEquals = false
        let next = i
        let skip = false

        for (; i < to; i++) {
            const value = tokens[i].value

            if (value === '(') {
                round++
                containsParen = true
                segment.push(tokens[i])
                continue
            }
            if (value === ')') {
                round--
                segment.push(tokens[i])
                continue
            }
            if (value === '[') {
                square++
                segment.push(tokens[i])
                continue
            }
            if (value === ']') {
                square--
                segment.push(tokens[i])
                continue
            }

            if (round === 0 && square === 0) {
                if (value === '=') containsEquals = true

                if (value === ';') {
                    next = i + 1
                    break
                }

                if (value === '{') {
                    const close = matchPair(tokens, i, '{', '}')
                    const end = close === -1 ? to - 1 : close

                    // Вложенный тип пропускаем целиком
                    if (isTypeDeclaration(segment)) {
                        next = end + 1
                        if (tokens[next]?.value === ';') next++
                        skip = true
                        i = end
                        break
                    }

                    if (containsEquals) {
                        // Инициализатор объектом/массивом: { ... } — часть выражения
                        i = end
                        continue
                    }

                    if (!containsParen) {
                        // Свойства: { get; set; }, после блока может идти = значение;
                        let k = end + 1
                        if (tokens[k]?.value === '=') {
                            let r = 0
                            let sq = 0
                            let cb = 0
                            for (k++; k < to; k++) {
                                const u = tokens[k].value
                                if (u === '(') r++
                                else if (u === ')') r--
                                else if (u === '[') sq++
                                else if (u === ']') sq--
                                else if (u === '{') cb++
                                else if (u === '}') cb--
                                else if (u === ';' && r === 0 && sq === 0 && cb === 0) break
                            }
                            next = k + 1
                        } else {
                            next = end + 1
                        }
                        i = end
                        break
                    }

                    // Тело метода/конструктора — объявление заканчивается на }
                    next = end + 1
                    i = end
                    break
                }
            }

            segment.push(tokens[i])
        }

        if (next <= i && next <= to) next = Math.min(to, i + 1)

        if (!skip && segment.length > 0) {
            members.push(...parseMemberSegment(segment, pendingAttributes))
        }

        pendingAttributes = []
        i = next
    }

    return members
}

/* ---------- Разбор объявлений ---------- */

const PRIMITIVE_NUMBERS = new Set([
    'sbyte', 'byte', 'short', 'ushort', 'int', 'uint', 'long', 'ulong',
    'nint', 'nuint', 'float', 'double', 'decimal', 'half',
    'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64',
    'single', 'biginteger', 'intptr', 'uintptr'
])

const COLLECTIONS = new Set([
    'list', 'ilist', 'ireadonlylist', 'icollection', 'ireadonlycollection',
    'ienumerable', 'arraylist', 'hashset', 'iset', 'sortedset',
    'queue', 'stack', 'linkedlist', 'collection', 'observablecollection',
    'readonlycollection', 'concurrentbag', 'concurrentqueue', 'concurrentstack',
    'immutablearray', 'immutablelist', 'immutablehashset', 'blockingcollection'
])

const DICTIONARIES = new Set([
    'dictionary', 'idictionary', 'ireadonlydictionary', 'sorteddictionary',
    'sortedlist', 'concurrentdictionary', 'immutabledictionary', 'hashtable'
])

function simpleTypeName(tokens: Token[]): string {
    return parseTypeTokens(tokens).name
}

function parseBaseTypes(tokens: Token[], from: number, to: number): string[] {
    if (from >= to) return []
    return splitTopLevel(tokens.slice(from, to), ',')
        .map((part) => simpleTypeName(part))
        .filter(Boolean)
}

function parsePrimaryParameters(
    tokens: Token[],
    open: number,
    close: number
): MemberInfo[] {
    const members: MemberInfo[] = []

    for (const rawPart of splitTopLevel(tokens.slice(open + 1, close), ',')) {
        let part = rawPart
        const attributes: AttributeInfo[] = []

        // Атрибуты параметра
        while (part[0]?.value === '[') {
            const end = matchPair(part, 0, '[', ']')
            if (end === -1) break
            attributes.push(...parseAttributes(part.slice(1, end)))
            part = part.slice(end + 1)
        }

        // Модификаторы параметра
        let start = 0
        while (start < part.length && ['this', 'ref', 'out', 'in', 'params', 'scoped', 'readonly'].includes(part[start].value)) {
            start++
        }
        part = part.slice(start)

        let cut = part.length
        const depth: Depth = { round: 0, square: 0, angle: 0, curly: 0 }
        for (let i = 0; i < part.length; i++) {
            const v = part[i].value
            if (v === '(') depth.round++
            else if (v === ')') depth.round--
            else if (v === '[') depth.square++
            else if (v === ']') depth.square--
            else if (v === '<') depth.angle++
            else if (v === '>') depth.angle = Math.max(0, depth.angle - 1)
            else if (isTop(depth) && v === '=') {
                cut = i
                break
            }
        }

        const decl = part.slice(0, cut)
        let nameIndex = -1
        for (let i = decl.length - 1; i >= 0; i--) {
            if (decl[i].kind === 'id') {
                nameIndex = i
                break
            }
        }
        if (nameIndex <= 0) continue

        const name = cleanIdentifier(decl[nameIndex].value)
        const type = parseTypeTokens(decl.slice(0, nameIndex))
        if (!name || !type.name) continue

        const json = jsonNameOf(attributes)
        members.push({
            name,
            type,
            jsonName: json.name,
            hasJsonAttr: json.present,
            ignored: isIgnored(attributes),
            isPublic: true
        })
    }

    return members
}

function collectTypes(
    tokens: Token[],
    from: number,
    to: number,
    nested: boolean,
    out: Collected
): void {
    for (let i = from; i < to; i++) {
        const token = tokens[i]
        if (token.kind !== 'id' || !TYPE_KEYWORDS.has(token.value)) continue

        let keyword = token.value
        let nameIndex = i + 1

        // record class / record struct
        if (keyword === 'record') {
            const modifier = tokens[nameIndex]?.value
            if (modifier === 'class' || modifier === 'struct') {
                keyword = modifier
                nameIndex++
            }
        }

        const nameToken = tokens[nameIndex]
        if (!nameToken || nameToken.kind !== 'id') continue

        const name = cleanIdentifier(nameToken.value)

        // Ищем границу заголовка: { тела } или ; (record без тела)
        let depth: Depth = { round: 0, square: 0, angle: 0, curly: 0 }
        let bodyStart = -1
        let headerEnd = to
        let whereIndex = to
        let k = nameIndex + 1

        for (; k < to; k++) {
            const v = tokens[k].value
            if (v === '(') depth.round++
            else if (v === ')') depth.round--
            else if (v === '[') depth.square++
            else if (v === ']') depth.square--
            else if (v === '<') depth.angle++
            else if (v === '>') depth.angle = Math.max(0, depth.angle - 1)

            if (!isTop(depth)) continue

            if (v === 'where' && whereIndex === to) whereIndex = k
            if (v === '{') {
                bodyStart = k
                headerEnd = Math.min(headerEnd, k)
                break
            }
            if (v === ';') {
                headerEnd = Math.min(headerEnd, k)
                break
            }
        }

        headerEnd = Math.min(headerEnd, whereIndex)

        if (keyword === 'enum') {
            out.enums.add(name)
            i = bodyStart === -1 ? k : Math.max(k, matchPair(tokens, bodyStart, '{', '}'))
            continue
        }
        if (keyword === 'interface') {
            i = bodyStart === -1 ? k : Math.max(k, matchPair(tokens, bodyStart, '{', '}'))
            continue
        }

        // Заголовок: [primary ctor] [: base list]
        let colon = -1
        depth = { round: 0, square: 0, angle: 0, curly: 0 }
        for (let j = nameIndex + 1; j < headerEnd; j++) {
            const v = tokens[j].value
            if (v === '(') depth.round++
            else if (v === ')') depth.round--
            else if (v === '[') depth.square++
            else if (v === ']') depth.square--
            else if (v === '<') depth.angle++
            else if (v === '>') depth.angle = Math.max(0, depth.angle - 1)
            else if (isTop(depth) && v === ':') {
                colon = j
                break
            }
        }

        let primaryOpen = -1
        depth = { round: 0, square: 0, angle: 0, curly: 0 }
        const paramsLimit = colon === -1 ? headerEnd : colon
        for (let j = nameIndex + 1; j < paramsLimit; j++) {
            const v = tokens[j].value
            if (v === '(' && isTop(depth)) {
                primaryOpen = j
                break
            }
            if (v === '[') depth.square++
            else if (v === ']') depth.square--
            else if (v === '<') depth.angle++
            else if (v === '>') depth.angle = Math.max(0, depth.angle - 1)
        }

        const members: MemberInfo[] = []

        if (primaryOpen !== -1) {
            const primaryClose = matchPair(tokens, primaryOpen, '(', ')')
            if (primaryClose !== -1) {
                members.push(...parsePrimaryParameters(tokens, primaryOpen, primaryClose))
            }
        }

        let bodyEnd = bodyStart
        if (bodyStart !== -1) {
            const close = matchPair(tokens, bodyStart, '{', '}')
            bodyEnd = close === -1 ? to - 1 : close
            members.push(...parseMembers(tokens, bodyStart + 1, bodyEnd))
        }

        const baseTypes = colon === -1 ? [] : parseBaseTypes(tokens, colon + 1, headerEnd)

        const info: ClassInfo = {
            name,
            nested,
            baseTypes,
            members
        }
        if (!out.classes.has(name)) out.classes.set(name, info)
        out.order.push(info)

        // Вложенные типы
        if (bodyStart !== -1) {
            collectTypes(tokens, bodyStart + 1, bodyEnd, true, out)
        }

        i = bodyStart === -1 ? k : bodyEnd
    }
}

/* ---------- Сборка JSON ---------- */

type Context = {
    classes: Map<string, ClassInfo>
    enums: Set<string>
    stack: string[]
}

const NULL_TYPES = new Set(['object', 'dynamic'])

function primitiveDefault(name: string): JsonValue | undefined {
    const lower = name.toLowerCase()

    if (PRIMITIVE_NUMBERS.has(lower)) return 0
    if (lower === 'bool' || lower === 'boolean') return false
    if (lower === 'string') return ''
    if (lower === 'char') return ''

    if (lower === 'datetime') return '0001-01-01T00:00:00'
    if (lower === 'datetimeoffset') return '0001-01-01T00:00:00+00:00'
    if (lower === 'dateonly') return '0001-01-01'
    if (lower === 'timeonly') return '00:00:00'
    if (lower === 'timespan') return '00:00:00'
    if (lower === 'guid') return '00000000-0000-0000-0000-000000000000'

    if (NULL_TYPES.has(lower)) return null
    return undefined
}

function defaultValue(type: TypeRef, context: Context): JsonValue {
    const lower = type.name.toLowerCase()

    // byte[] сериализуется в base64-строку, а не в массив чисел
    if (type.arrayDepth > 0) {
        if (type.arrayDepth === 1 && (lower === 'byte' || lower === 'sbyte')) return ''
        const element = { ...type, arrayDepth: type.arrayDepth - 1 }
        return [defaultValue(element, context)]
    }

    if (type.name === 'ValueTuple' || type.name === 'Tuple') {
        const out: Record<string, JsonValue> = {}
        type.args.forEach((arg, index) => {
            out[`Item${index + 1}`] = defaultValue(arg, context)
        })
        return out
    }

    if (type.name === 'KeyValuePair' && type.args.length === 2) {
        return {
            Key: defaultValue(type.args[0], context),
            Value: defaultValue(type.args[1], context)
        }
    }

    if (type.nullable || type.name === 'Nullable') {
        return lower === 'string' ? '' : null
    }

    const primitive = primitiveDefault(type.name)
    if (primitive !== undefined) return primitive

    if (DICTIONARIES.has(lower)) return {}

    if (COLLECTIONS.has(lower) && type.args.length > 0) {
        return [defaultValue(type.args[0], context)]
    }

    if (context.enums.has(type.name)) return 0

    const info = context.classes.get(type.name)
    if (info) return buildClass(info, context)

    // Неизвестный тип (из другой сборки, generic-параметр и т.п.)
    return null
}

function includedMembers(info: ClassInfo): MemberInfo[] {
    // Атрибуты есть — работает режим «только помеченные»; иначе берём все public-поля
    const optIn = info.members.some((member) => member.hasJsonAttr)
    return info.members.filter(
        (member) =>
            !member.ignored &&
            (member.isPublic || member.hasJsonAttr) &&
            (!optIn || member.hasJsonAttr)
    )
}

function buildClass(info: ClassInfo, context: Context): JsonValue {
    // Рекурсивные ссылки (класс содержит сам себя) обрываем пустым объектом
    if (context.stack.includes(info.name)) return {}

    context.stack.push(info.name)

    const out: Record<string, JsonValue> = {}

    for (const baseName of info.baseTypes) {
        const base = context.classes.get(baseName)
        if (base && base !== info) {
            const baseValue = buildClass(base, context)
            if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
                Object.assign(out, baseValue)
            }
        }
    }

    for (const member of includedMembers(info)) {
        out[member.jsonName ?? member.name] = defaultValue(member.type, context)
    }

    context.stack.pop()
    return out
}

function referencedTypeNames(type: TypeRef, target: Set<string>): void {
    if (type.name) target.add(type.name)
    for (const arg of type.args) referencedTypeNames(arg, target)
}

/**
 * Преобразует C#-код в заготовку JSON.
 * Понимает целый файл, отдельный класс и просто список полей/свойств,
 * скопированный из класса (без имени класса и фигурных скобок).
 * Бросает CSharpParseError, если не нашлось ни класса, ни полей.
 */
export function csharpToJson(source: string): JsonValue {
    if (!source.trim()) throw new CSharpParseError('Пустой ввод')

    const tokens = tokenize(source)
    const collected: Collected = {
        classes: new Map(),
        order: [],
        enums: new Set()
    }

    collectTypes(tokens, 0, tokens.length, false, collected)

    if (collected.order.length === 0) {
        // Ни класса, ни структуры нет — пробуем разобрать ввод как список полей:
        // так можно вставить только поля/свойства, скопированные из класса
        const members = parseMembers(tokens, 0, tokens.length)
        if (members.length === 0) {
            throw new CSharpParseError(
                'Не найдено ни класса (class, struct, record), ни полей. Вставьте класс, ' +
                    'целый файл с using — или просто список полей/свойств из класса.'
            )
        }

        const root: ClassInfo = {
            name: '__JsonPrettyRoot',
            nested: false,
            baseTypes: [],
            members
        }

        return buildClass(root, {
            classes: new Map([[root.name, root]]),
            enums: collected.enums,
            stack: []
        })
    }

    const topLevel = collected.order.filter((info) => !info.nested)
    const candidates = topLevel.length > 0 ? topLevel : collected.order

    // Корневой — тот, на который не ссылаются поля других классов
    const referenced = new Set<string>()
    for (const info of candidates) {
        for (const baseName of info.baseTypes) referenced.add(baseName)
        for (const member of info.members) referencedTypeNames(member.type, referenced)
    }

    let root = candidates.find((info) => !referenced.has(info.name))

    // Всё друг на друга ссылаются (например, самоссылка): берём класс,
    // который ссылается на большее число других классов
    if (!root) {
        let bestScore = -1
        for (const info of candidates) {
            const names = new Set<string>()
            for (const member of info.members) referencedTypeNames(member.type, names)
            names.delete(info.name)
            const score = [...names].filter((name) => candidates.some((other) => other.name === name)).length
            if (score > bestScore) {
                bestScore = score
                root = info
            }
        }
    }

    const chosen = root ?? candidates[0]

    return buildClass(chosen, {
        classes: collected.classes,
        enums: collected.enums,
        stack: []
    })
}
