export type Match = {
    start: number
    end: number
}

/** Ограничение на количество подсвечиваемых совпадений — чтобы не плодить узлы. */
const MAX_MATCHES = 2000

export function findMatches(text: string, query: string): Match[] {
    if (!query) return []

    const haystack = text.toLowerCase()
    const needle = query.toLowerCase()
    const matches: Match[] = []

    let index = haystack.indexOf(needle)
    while (index !== -1 && matches.length < MAX_MATCHES) {
        matches.push({ start: index, end: index + needle.length })
        index = haystack.indexOf(needle, index + needle.length)
    }

    return matches
}
