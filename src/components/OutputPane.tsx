import { useMemo } from 'react'
import { cmSetup } from '../lib/cmSetup'
import type { JsonValue } from '../lib/parseLoose'
import CodeEditor from './CodeEditor'
import CopyButton from './CopyButton'

export type OutputState =
    | { variant: 'json'; text: string; value: JsonValue }
    | { variant: 'error'; text: string }

type Props = {
    output: OutputState | null
}

/**
 * Панель «Результат». Готовый JSON показываем в CodeMirror только для чтения:
 * нужны подсветка и сворачивание, а правки и мультикурсор тут ни к чему.
 * Пустое состояние и текст ошибки остаются обычным <pre> — так они и выглядели.
 */
export default function OutputPane({ output }: Props) {
    const isJson = output?.variant === 'json'
    // Расширения собираем один раз: редактор создаётся тоже один раз.
    // В «Результате» нет номеров строк, зато длинные строки переносятся:
    // горизонтальная прокрутка готового JSON только мешает читать
    const extensions = useMemo(
        () => cmSetup({ readOnly: true, lineNumbers: false, wrap: true }),
        []
    )

    return (
        <section className="pane">
            <div className="pane-head">
                <span>Результат</span>
                {output && (
                    <CopyButton
                        text={output.text}
                        title={isJson ? 'Копировать результат' : 'Копировать текст ошибки'}
                    />
                )}
                <span className="count">{output ? `${output.text.length} симв.` : ''}</span>
            </div>
            <div className="pane-body">
                {output === null ? (
                    <pre className="output empty">Здесь появится результат…</pre>
                ) : output.variant === 'json' ? (
                    <CodeEditor className="cm-host" value={output.text} extensions={extensions} />
                ) : (
                    <pre className="output error-text">{output.text}</pre>
                )}
            </div>
        </section>
    )
}
