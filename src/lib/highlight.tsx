import type { ReactNode } from 'react'

export type TokenKind = 'j-key' | 'j-str' | 'j-bool' | 'j-null' | 'j-num' | 'j-punct'

export type Token = {
    start: number
    end: number
    kind: TokenKind
}

export type MarkKind = 'find' | 'find-active' | 'bracket'

export type Mark = {
    start: number
    end: number
    kind: MarkKind
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

function markClass(kind: MarkKind): string {
    if (kind === 'bracket') return 'j-bracket-match'
    if (kind === 'find-active') return 'j-mark j-mark-active'
    return 'j-mark'
}

/**
 * Собирает React-узлы из текста, токенов и пометок (совпадения поиска, парные скобки).
 * Пометки разрезают токены на части, поэтому рендер идёт одним проходом по границам.
 */
export function renderTokens(text: string, tokens: Token[], marks: Mark[] = []): ReactNode[] {
    const nodes: ReactNode[] = []
    const sorted = [...marks].sort((a, b) => a.start - b.start)
    let key = 0

    const emit = (from: number, to: number, className?: string) => {
        let cursor = from

        for (const mark of sorted) {
            if (mark.end <= cursor) continue
            if (mark.start >= to) break

            const start = Math.max(mark.start, cursor)
            const end = Math.min(mark.end, to)

            if (start > cursor) {
                const piece = text.slice(cursor, start)
                nodes.push(
                    className ? (
                        <span className={className} key={key++}>
                            {piece}
                        </span>
                    ) : (
                        piece
                    )
                )
            }

            nodes.push(
                <span className={markClass(mark.kind)} key={key++}>
                    {text.slice(start, end)}
                </span>
            )

            cursor = end
        }

        if (cursor < to) {
            const piece = text.slice(cursor, to)
            nodes.push(
                className ? (
                    <span className={className} key={key++}>
                        {piece}
                    </span>
                ) : (
                    piece
                )
            )
        }
    }

    let cursor = 0
    for (const token of tokens) {
        if (token.start > cursor) emit(cursor, token.start)
        emit(token.start, token.end, token.kind)
        cursor = token.end
    }
    if (cursor < text.length) emit(cursor, text.length)

    return nodes
}

/** Подсветка JSON готовыми узлами — для панели «Результат». */
export function highlightJson(text: string): ReactNode[] {
    return renderTokens(text, tokenizeJson(text))
}
