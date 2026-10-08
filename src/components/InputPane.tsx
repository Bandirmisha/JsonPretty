import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { Braces } from 'lucide-react'
import { cmSetup, setSearchHighlight } from '../lib/cmSetup'
import { findMatches } from '../lib/find'
import ClearButton from './ClearButton'
import CodeEditor from './CodeEditor'
import FindBar from './FindBar'

const PLACEHOLDER = 'Вставьте JSON или строку с JSON'

/**
 * Хоткей с буквой. event.key зависит от раскладки (на русской Ctrl+F даёт «а»),
 * поэтому ориентируемся на физическую клавишу event.code, а key — запасной вариант.
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
    const viewRef = useRef<EditorView | null>(null)

    const [findOpen, setFindOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)

    // Расширения собираем один раз: редактор создаётся тоже один раз
    const extensions = useMemo(() => cmSetup({ placeholder: PLACEHOLDER }), [])
    const matches = useMemo(() => findMatches(value, query), [value, query])
    const safeIndex = matches.length ? Math.min(activeIndex, matches.length - 1) : 0

    const handleReady = useCallback((view: EditorView) => {
        viewRef.current = view
        view.focus()
    }, [])

    const setFindQuery = useCallback((next: string) => {
        setQuery(next)
        setActiveIndex(0)
        // Совпадения рисует наш плагин подсветки по своему состоянию
        viewRef.current?.dispatch({ effects: setSearchHighlight.of({ query: next, active: 0 }) })
    }, [])

    const goToMatch = useCallback(
        (index: number) => {
            const view = viewRef.current
            if (!view) return

            // Совпадения считаем по живому документу, а не по состоянию React:
            // оно может отставать на один рендер, и позиции вышли бы за границы текста
            const list = findMatches(view.state.doc.toString(), query)
            if (list.length === 0) return

            // Номер ведём сами: так счётчик и переходы предсказуемы
            const safe = ((index % list.length) + list.length) % list.length
            setActiveIndex(safe)

            // Фокус из строки поиска не забираем: совпадение выделяется и
            // подкручивается без фокуса, а иначе после первого Enter он уходил бы
            // в редактор и следующее нажатие уже не переключало совпадения
            const match = list[safe]
            view.dispatch({
                selection: { anchor: match.start, head: match.end },
                effects: setSearchHighlight.of({ query, active: safe }),
                scrollIntoView: true
            })
        },
        [query]
    )

    const closeFind = useCallback(() => {
        setFindOpen(false)
        setQuery('')
        setActiveIndex(0)
        viewRef.current?.dispatch({ effects: setSearchHighlight.of({ query: '', active: -1 }) })
        viewRef.current?.focus()
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

    const handleTemplate = () => {
        onTemplate()

        const view = viewRef.current
        if (view) {
            view.dispatch({ selection: { anchor: 0 }, scrollIntoView: true })
            view.focus()
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
                    onQuery={setFindQuery}
                    onNext={() => goToMatch(safeIndex + 1)}
                    onPrev={() => goToMatch(safeIndex - 1)}
                    onClose={closeFind}
                />
            )}

            <div className="pane-body">
                <CodeEditor
                    className="cm-host"
                    value={value}
                    onChange={onChange}
                    onReady={handleReady}
                    extensions={extensions}
                />
            </div>
        </section>
    )
}
