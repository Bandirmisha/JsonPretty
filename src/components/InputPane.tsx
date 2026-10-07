import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { Braces } from 'lucide-react'
import { bracketMatchAt } from '../lib/brackets'
import { writeClipboard } from '../lib/clipboard'
import {
    backspaceIndentEdit,
    backspacePairEdit,
    cutLineEdit,
    dedentEdit,
    indentEdit,
    newlineEdit,
    pairEdit,
    type Ctx,
    type Edit
} from '../lib/editorOps'
import { findMatches, lineIndexAt } from '../lib/find'
import { renderTokens, tokenizeJson, type Mark } from '../lib/highlight'
import ClearButton from './ClearButton'
import FindBar from './FindBar'

/** Символы, для которых работает автозакрытие и «перешагивание». */
const PAIR_CHARS = new Set(['"', '{', '[', '}', ']'])
/** Выше этого числа строк гаттер не рисуем — слишком много узлов на каждый ввод. */
const MAX_GUTTER_LINES = 5000

/**
 * Хоткей с буквой. event.key зависит от раскладки (на русской Ctrl+X даёт «ч»),
 * поэтому ориентируемся на физическую клавишу event.code, а key оставляем как запасной вариант.
 */
const isCtrlLetter = (event: { ctrlKey: boolean; code: string; key: string }, code: string, letter: string) =>
    event.ctrlKey && (event.code === code || event.key.toLowerCase() === letter)

type Props = {
    value: string
    onChange: (value: string) => void
    onClear: () => void
    onTemplate: () => void
    /** Пока открыто модальное окно, хоткеи поля не работают */
    suspended?: boolean
}

export default function InputPane({ value, onChange, onClear, onTemplate, suspended }: Props) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const mirrorRef = useRef<HTMLPreElement>(null)

    const [caret, setCaret] = useState(0)
    const [focused, setFocused] = useState(false)
    const [scrollTop, setScrollTop] = useState(0)

    const [findOpen, setFindOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)

    const matches = useMemo(() => findMatches(value, query), [value, query])
    const tokens = useMemo(() => tokenizeJson(value), [value])
    const safeIndex = matches.length ? Math.min(activeIndex, matches.length - 1) : 0

    // Подсветка в поле: зеркальный <pre> под прозрачной textarea
    const marks = useMemo<Mark[]>(() => {
        const list: Mark[] = []

        if (focused) {
            const pair = bracketMatchAt(value, caret)
            if (pair) {
                list.push({ start: pair.open, end: pair.open + 1, kind: 'bracket' })
                list.push({ start: pair.close, end: pair.close + 1, kind: 'bracket' })
            }
        }

        matches.forEach((match, index) => {
            list.push({ start: match.start, end: match.end, kind: index === safeIndex ? 'find-active' : 'find' })
        })

        return list
    }, [value, caret, focused, matches, safeIndex])

    const lineCount = useMemo(() => value.split('\n').length, [value])
    const lineNumbers = useMemo(() => {
        if (lineCount > MAX_GUTTER_LINES) return ''
        const numbers: string[] = []
        for (let i = 1; i <= lineCount; i++) numbers.push(String(i))
        return numbers.join('\n')
    }, [lineCount])

    useEffect(() => {
        textareaRef.current?.focus()
    }, [])

    // Каретка может двигаться мышью, стрелками и программно — следим за selectionchange
    useEffect(() => {
        const onSelectionChange = () => {
            const textarea = textareaRef.current
            if (textarea && document.activeElement === textarea) setCaret(textarea.selectionStart)
        }

        document.addEventListener('selectionchange', onSelectionChange)
        return () => document.removeEventListener('selectionchange', onSelectionChange)
    }, [])

    const syncScroll = useCallback(() => {
        const textarea = textareaRef.current
        const mirror = mirrorRef.current
        if (!textarea || !mirror) return

        mirror.scrollTop = textarea.scrollTop
        mirror.scrollLeft = textarea.scrollLeft
        setScrollTop(textarea.scrollTop)
    }, [])

    // значение меняется программно (шаблон, очистка) — слой тоже надо выровнять
    useEffect(syncScroll, [value, syncScroll])

    const readCtx = (): Ctx | null => {
        const textarea = textareaRef.current
        if (!textarea) return null
        return {
            value: textarea.value,
            selectionStart: textarea.selectionStart,
            selectionEnd: textarea.selectionEnd
        }
    }

    const syncCaret = useCallback(() => {
        const textarea = textareaRef.current
        if (textarea) setCaret(textarea.selectionStart)
    }, [])

    /**
     * Правка применяется через execCommand: так она попадает в нативный undo
     * textarea и Ctrl+Z продолжает работать.
     */
    const applyEdit = useCallback(
        (edit: Edit | null) => {
            if (!edit) return
            const textarea = textareaRef.current
            if (!textarea) return

            textarea.focus()

            if (edit.start === edit.end && edit.text === '') {
                textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd)
                setCaret(edit.selectionStart)
                return
            }

            textarea.setSelectionRange(edit.start, edit.end)
            if (edit.text) document.execCommand('insertText', false, edit.text)
            else document.execCommand('delete')

            textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd)
            setCaret(edit.selectionStart)
            syncScroll()
        },
        [syncScroll]
    )

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        if (suspended) return

        const ctx = readCtx()
        if (!ctx) return

        if (event.key === 'Tab') {
            event.preventDefault()
            applyEdit(event.shiftKey ? dedentEdit(ctx) : indentEdit(ctx))
            return
        }

        if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
            event.preventDefault()
            applyEdit(newlineEdit(ctx))
            return
        }

        if (event.key === 'Backspace') {
            const pair = backspacePairEdit(ctx)
            if (pair) {
                event.preventDefault()
                applyEdit(pair)
                return
            }

            // стираем всю последовательность пробелов перед кареткой
            const indent = backspaceIndentEdit(ctx)
            if (indent) {
                event.preventDefault()
                applyEdit(indent)
            }
            return
        }

        // Ctrl+X без выделения вырезает всю строку целиком
        if (isCtrlLetter(event, 'KeyX', 'x')) {
            const cut = cutLineEdit(ctx)
            if (cut) {
                event.preventDefault()
                // буфер и удаление идут параллельно: если буфер недоступен,
                // строка всё равно вырежется
                void writeClipboard(cut.text).catch(() => undefined)
                applyEdit(cut.edit)
            }
            return
        }

        if (event.key.length === 1 && PAIR_CHARS.has(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const edit = pairEdit(ctx, event.key)
            if (edit) {
                event.preventDefault()
                applyEdit(edit)
            }
        }
    }

    const goToMatch = useCallback(
        (index: number) => {
            const textarea = textareaRef.current
            if (!textarea || matches.length === 0) return

            const safe = ((index % matches.length) + matches.length) % matches.length
            setActiveIndex(safe)

            const match = matches[safe]
            textarea.setSelectionRange(match.start, match.end)
            setCaret(match.start)

            const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 21
            const top = lineIndexAt(textarea.value, match.start) * lineHeight
            const visibleFrom = textarea.scrollTop
            const visibleTo = visibleFrom + textarea.clientHeight

            if (top < visibleFrom + lineHeight || top > visibleTo - lineHeight * 2) {
                textarea.scrollTop = Math.max(0, top - textarea.clientHeight / 3)
            }

            syncScroll()
        },
        [matches, syncScroll]
    )

    const closeFind = useCallback(() => {
        setFindOpen(false)
        setQuery('')
        setActiveIndex(0)
        textareaRef.current?.focus()
    }, [])

    // Ctrl+F — поиск по вводу, Esc — закрыть
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (suspended) return

            if (isCtrlLetter(event, 'KeyF', 'f')) {
                event.preventDefault()
                setFindOpen(true)
                return
            }
            if (event.key === 'Escape' && findOpen) {
                event.preventDefault()
                closeFind()
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [findOpen, closeFind, suspended])

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        onChange(event.target.value)
        setCaret(event.target.selectionStart)
    }

    const handleTemplate = () => {
        onTemplate()
        const textarea = textareaRef.current
        if (textarea) {
            textarea.scrollTop = 0
            textarea.setSelectionRange(0, 0)
            textarea.focus()
        }
    }

    return (
        <section className="pane">
            <div className="pane-head">
                <span>Ввод</span>
                <ClearButton onClick={onClear} disabled={value.length === 0} />
                <button
                    type="button"
                    className="soft-btn with-icon"
                    onClick={handleTemplate}
                    title="Подставить шаблон JSON"
                >
                    <Braces size={14} />
                    Шаблон
                </button>
                <span className="count">{value.length} симв.</span>
            </div>

            {findOpen && (
                <FindBar
                    query={query}
                    total={matches.length}
                    activeIndex={safeIndex}
                    onQuery={(next) => {
                        setQuery(next)
                        setActiveIndex(0)
                    }}
                    onNext={() => goToMatch(safeIndex + 1)}
                    onPrev={() => goToMatch(safeIndex - 1)}
                    onClose={closeFind}
                />
            )}

            <div className="pane-body">
                <div className="input-wrap">
                    {lineNumbers && (
                        <div className="input-gutter">
                            <pre
                                className="gutter-inner"
                                style={{ transform: `translateY(${-scrollTop}px)` }}
                            >
                                {lineNumbers}
                            </pre>
                        </div>
                    )}

                    <div className="input-stack">
                        <pre className="input-mirror" ref={mirrorRef} aria-hidden="true">
                            {renderTokens(value, tokens, marks)}
                            {/* при переводе строки в конце <pre> не создаёт новую строку — держим высоту пробелом */}
                            {value.endsWith('\n') ? ' ' : null}
                        </pre>
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            onScroll={syncScroll}
                            onSelect={syncCaret}
                            onClick={syncCaret}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            spellCheck={false}
                            placeholder='Вставьте JSON или строку с JSON, например: {"a":1,"b":[1,2]}'
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}
