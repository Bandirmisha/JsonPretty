import { Eraser } from 'lucide-react'

type Props = {
    onClick: () => void
    disabled?: boolean
}

/** Кнопка очистки — только иконка, смысл в title/aria-label */
export default function ClearButton({ onClick, disabled }: Props) {
    return (
        <button
            type="button"
            className="icon-btn clear-btn"
            onClick={onClick}
            disabled={disabled}
            title="Очистить"
            aria-label="Очистить"
        >
            <Eraser size={14} />
        </button>
    )
}
