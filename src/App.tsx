import { useCallback, useEffect, useRef, useState } from 'react'
import ActionBar from './components/ActionBar'
import HelpDialog from './components/HelpDialog'
import InputPane from './components/InputPane'
import LogPanel, { type LogAction, type LogEntry } from './components/LogPanel'
import OutputPane, { type OutputState } from './components/OutputPane'
import ThemeSelect from './components/ThemeSelect'
import { CircleHelp } from 'lucide-react'
import { parseLoose, stringifyJson } from './lib/parseLoose'
import { templateText } from './lib/template'
import { loadTheme, saveTheme, type ThemeId } from './lib/themes'

const MAX_LOG_ENTRIES = 100
/** Защита от гигантских значений: журнал хранит ввод и результат целиком, но не бесконечно */
const MAX_VALUE_LENGTH = 100_000
const TRUNCATED = '\n… (значение обрезано)'

function limit(text: string): string {
    return text.length > MAX_VALUE_LENGTH ? text.slice(0, MAX_VALUE_LENGTH) + TRUNCATED : text
}

export default function App() {
    const [input, setInput] = useState('')
    const [output, setOutput] = useState<OutputState | null>(null)

    const [theme, setTheme] = useState<ThemeId>(loadTheme)

    const [log, setLog] = useState<LogEntry[]>([])
    const [logOpen, setLogOpen] = useState(false)
    const [helpOpen, setHelpOpen] = useState(false)
    const nextLogId = useRef(1)

    const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'time'>) => {
        setLog((prev) => {
            const next: LogEntry[] = [
                ...prev,
                {
                    ...entry,
                    input: limit(entry.input),
                    output: limit(entry.output),
                    id: nextLogId.current++,
                    time: new Date().toLocaleTimeString('ru-RU')
                }
            ]
            return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next
        })
    }, [])

    // Тема живёт на <html data-theme>, поэтому её подхватывают и CSS-переменные, и select
    useEffect(() => {
        document.documentElement.dataset.theme = theme
        saveTheme(theme)
    }, [theme])

    /**
     * Разбор ввода, вывод результата и запись операции в журнал.
     * Вызывается и на нажатие кнопки, и на каждое изменение ввода —
     * в журнал попадает любая конвертация.
     */
    const applyFormat = useCallback(
        (indent: number) => {
            const action: LogAction = indent === 0 ? 'Minify' : 'Pretty'

            if (!input.trim()) {
                setOutput(null)
                return
            }

            try {
                const value = parseLoose(input)
                const text = stringifyJson(value, indent)

                setOutput({ variant: 'json', text, value })
                addLog({ action, ok: true, input: input.trim(), output: text })
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)

                setOutput({
                    variant: 'error',
                    text: `Не удалось разобрать JSON:\n${message}\n\n${input.trim()}`
                })
                addLog({ action, ok: false, input: input.trim(), output: message })
            }
        },
        [input, addLog]
    )

    // Автоматический Pretty при любом изменении ввода — без искусственной задержки
    useEffect(() => {
        applyFormat(2)
    }, [applyFormat])

    const clear = useCallback(() => {
        setInput('')
        setOutput(null)
    }, [])

    const insertTemplate = useCallback(() => {
        setInput(templateText())
    }, [])

    const toggleLog = useCallback(() => setLogOpen((open) => !open), [])

    return (
        <>
            <main>
                <InputPane
                    value={input}
                    onChange={setInput}
                    onClear={clear}
                    onTemplate={insertTemplate}
                    suspended={helpOpen}
                />
                <ActionBar
                    onPretty={() => applyFormat(2)}
                    onMinify={() => applyFormat(0)}
                >
                    <ThemeSelect value={theme} onChange={setTheme} />
                    <button
                        type="button"
                        className="with-icon"
                        onClick={() => setHelpOpen(true)}
                        title="Хоткеи и пояснения"
                    >
                        <CircleHelp size={15} />
                        Справка
                    </button>
                </ActionBar>
                <OutputPane output={output} />
            </main>

            <LogPanel
                entries={log}
                open={logOpen}
                onToggle={toggleLog}
                onClear={() => setLog([])}
            />

            <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
        </>
    )
}
