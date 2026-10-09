import { useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import ClearButton from './ClearButton'
import CopyButton from './CopyButton'

export type LogAction = 'Pretty' | 'Minify'

/** Подписи действий для журнала: существительные, внутренние имена — латиницей. */
const ACTION_LABELS: Record<LogAction, string> = {
    Pretty: 'Форматирование',
    Minify: 'Сокращение'
}

export type LogEntry = {
    id: number
    time: string
    action: LogAction
    ok: boolean
    /** Что было на входе (обрезка по MAX_VALUE_LENGTH выполняется в App) */
    input: string
    /** Что получилось на выходе; при ошибке — текст ошибки */
    output: string
}

type Props = {
    entries: LogEntry[]
    open: boolean
    onToggle: () => void
    onClear: () => void
}

export default function LogPanel({ entries, open, onToggle, onClear }: Props) {
    const bodyRef = useRef<HTMLDivElement>(null)

    // Всегда держим внизу — там самые свежие записи
    useEffect(() => {
        if (!open) return
        const body = bodyRef.current
        if (body) body.scrollTop = body.scrollHeight
    }, [entries.length, open])

    return (
        <section className="log-panel">
            {/* Сетка 1fr / auto / 1fr — «Журнал» всегда ровно по центру полосы */}
            <div className="log-head">
                <span className="log-head-side" />

                <button type="button" className="log-toggle" onClick={onToggle} aria-expanded={open}>
                    <ChevronRight size={14} className={`chev${open ? ' open' : ''}`} />
                    Журнал
                    <span className="log-count">{entries.length}</span>
                </button>

                <div className="log-right">
                    {/* Очистка нужна, только пока журнал раскрыт: в свёрнутой полосе
                        кнопка без дела сосёт внимание */}
                    {open && <ClearButton onClick={onClear} disabled={entries.length === 0} />}
                </div>
            </div>

            {open && (
                <div className="log-body" ref={bodyRef}>
                    {entries.length === 0 ? (
                        <div className="log-empty">
                            Журнал пуст. Здесь появятся операции «Форматирование» и «Сокращение» —
                            с вводом и результатом.
                        </div>
                    ) : (
                        entries.map((entry) => (
                            <article className={`log-entry${entry.ok ? '' : ' err'}`} key={entry.id}>
                                <div className="log-entry-head">
                                    <span className="t">{entry.time}</span>
                                    <span className="badge action">{ACTION_LABELS[entry.action]}</span>
                                    <span className={`badge ${entry.ok ? 'ok' : 'err'}`}>
                                        {entry.ok ? 'OK' : 'Ошибка'}
                                    </span>
                                    <span className="spacer" />
                                    <span className="log-entry-size">
                                        {entry.input.length} → {entry.output.length} симв.
                                    </span>
                                </div>

                                <div className="log-io-pair">
                                    <div className="log-io">
                                        <div className="log-io-head">
                                            <span className="log-io-label">Ввод</span>
                                            <CopyButton text={entry.input} title="Копировать ввод" />
                                        </div>
                                        <pre className="log-io-text">{entry.input}</pre>
                                    </div>

                                    <div className={`log-io${entry.ok ? '' : ' is-error'}`}>
                                        <div className="log-io-head">
                                            <span className="log-io-label">Результат</span>
                                            <CopyButton
                                                text={entry.output}
                                                title={
                                                    entry.ok
                                                        ? 'Копировать результат'
                                                        : 'Копировать текст ошибки'
                                                }
                                            />
                                        </div>
                                        <pre className="log-io-text">{entry.output}</pre>
                                    </div>
                                </div>
                            </article>
                        ))
                    )}
                </div>
            )}
        </section>
    )
}
