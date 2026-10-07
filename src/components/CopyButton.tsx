import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { writeClipboard } from '../lib/clipboard'

type Props = {
    text: string
    title: string
}

/**
 * Кнопка копирования. Обратная связь встроена в саму кнопку:
 * галочка при успехе, красная иконка при ошибке — статус-строки в UI больше нет.
 */
export default function CopyButton({ text, title }: Props) {
    const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

    const handleClick = async () => {
        try {
            await writeClipboard(text)
            setState('copied')
        } catch {
            setState('failed')
        }
        window.setTimeout(() => setState('idle'), 1400)
    }

    const className = `icon-btn${state === 'failed' ? ' is-error' : ''}`

    return (
        <button type="button" className={className} title={title} aria-label={title} onClick={handleClick}>
            {state === 'copied' ? <Check size={14} /> : <Copy size={14} />}
        </button>
    )
}
