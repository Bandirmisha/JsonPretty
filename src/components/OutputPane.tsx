import { highlightJson } from '../lib/highlight'
import type { JsonValue } from '../lib/parseLoose'
import CopyButton from './CopyButton'

export type OutputState =
    | { variant: 'json'; text: string; value: JsonValue }
    | { variant: 'error'; text: string }

type Props = {
    output: OutputState | null
}

export default function OutputPane({ output }: Props) {
    const isJson = output?.variant === 'json'

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
                    <pre className="output">{highlightJson(output.text)}</pre>
                ) : (
                    <pre className="output error-text">{output.text}</pre>
                )}
            </div>
        </section>
    )
}
