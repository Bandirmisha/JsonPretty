import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'

type Props = {
    query: string
    total: number
    activeIndex: number
    onQuery: (query: string) => void
    onNext: () => void
    onPrev: () => void
    onClose: () => void
}

export default function FindBar({
    query,
    total,
    activeIndex,
    onQuery,
    onNext,
    onPrev,
    onClose
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
    }, [])

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            if (event.shiftKey) onPrev()
            else onNext()
        }
        if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
        }
    }

    return (
        <div className="find-bar">
            <Search size={13} className="find-icon" />
            <input
                ref={inputRef}
                className="find-input"
                value={query}
                spellCheck={false}
                placeholder="Найти в вводе"
                onChange={(event) => onQuery(event.target.value)}
                onKeyDown={handleKeyDown}
            />
            <span className="find-count">{query ? (total ? `${activeIndex + 1}/${total}` : 'не найдено') : ''}</span>
            <button
                type="button"
                className="icon-btn"
                onClick={onPrev}
                disabled={total === 0}
                title="Предыдущее совпадение (Shift+Enter)"
            >
                <ChevronUp size={14} />
            </button>
            <button
                type="button"
                className="icon-btn"
                onClick={onNext}
                disabled={total === 0}
                title="Следующее совпадение (Enter)"
            >
                <ChevronDown size={14} />
            </button>
            <button type="button" className="icon-btn" onClick={onClose} title="Закрыть (Esc)">
                <X size={14} />
            </button>
        </div>
    )
}
