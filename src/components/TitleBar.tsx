import { useEffect, useState } from 'react'
import { Braces, Copy, Minus, Square, X } from 'lucide-react'

/**
 * Своя полоса заголовка вместо системной: окно создаётся с frame: false.
 * Зона -webkit-app-region: drag превращает полосу в аналог системного заголовка,
 * поэтому перетаскивание окна и его системные жесты (разворот двойным кликом,
 * прилипание к краю экрана) обрабатывает сама Windows, а не наш код.
 * Сворачивание, разворот и закрытие по кнопкам идут через IPC в главный процесс.
 * Своей обработки двойного клика здесь нет намеренно: она бы складывалась
 * с системной и разворот тут же отменялся.
 */
export default function TitleBar() {
    const controls = window.api?.windowControls
    const [maximized, setMaximized] = useState(false)

    useEffect(() => {
        if (!controls) return

        let alive = true
        void controls.isMaximized().then((value) => {
            if (alive) setMaximized(value)
        })
        // Окно может развернуться и не нашей кнопкой: Win+стрелка, перетаскивание к краю экрана
        controls.onMaximizedChange(setMaximized)

        return () => {
            alive = false
        }
    }, [controls])

    return (
        <header className="title-bar">
            <span className="title-mark">
                <Braces size={15} />
            </span>
            <span className="title-text">JsonPretty</span>

            {/* В браузере (без preload) кнопок управления окном нет — рисуем только название */}
            {controls && (
                <div className="title-actions">
                    <button
                        type="button"
                        className="title-btn"
                        title="Свернуть"
                        aria-label="Свернуть окно"
                        onClick={() => controls.minimize()}
                    >
                        <Minus size={16} />
                    </button>
                    <button
                        type="button"
                        className="title-btn"
                        title={maximized ? 'Восстановить' : 'Развернуть'}
                        aria-label={maximized ? 'Восстановить окно' : 'Развернуть окно'}
                        aria-pressed={maximized}
                        onClick={() => controls.toggleMaximize()}
                    >
                        {maximized ? <Copy size={13} /> : <Square size={13} />}
                    </button>
                    <button
                        type="button"
                        className="title-btn title-btn-close"
                        title="Закрыть"
                        aria-label="Закрыть окно"
                        onClick={() => controls.close()}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
        </header>
    )
}
