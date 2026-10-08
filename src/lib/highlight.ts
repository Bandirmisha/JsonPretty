export type TokenKind = 'j-key' | 'j-str' | 'j-bool' | 'j-null' | 'j-num' | 'j-punct'

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
