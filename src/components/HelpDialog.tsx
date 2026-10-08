import { Fragment, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { SHORTCUT_GROUPS } from '../lib/shortcuts'

type Props = {
    open: boolean
    onClose: () => void
}

export default function HelpDialog({ open, onClose }: Props) {
    const closeRef = useRef<HTMLButtonElement>(null)
    const dialogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return

        closeRef.current?.focus()

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
                return
            }

            // Фокус не уходит за пределы окна: Tab циклично обходит его элементы
            if (event.key === 'Tab') {
                const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
                if (!focusables || focusables.length === 0) return

                event.preventDefault()
                const list = [...focusables]
                const current = list.indexOf(document.activeElement as HTMLElement)
                const step = event.shiftKey ? -1 : 1
                list[(current + step + list.length) % list.length].focus()
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [open, onClose])

    if (!open) return null

    return (
        <div className="help-overlay" onClick={onClose} role="presentation">
            <div
                className="help-dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Справка"
                ref={dialogRef}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="help-head">
                    <h2>Справка</h2>
                    <button
                        ref={closeRef}
                        type="button"
                        className="icon-btn"
                        onClick={onClose}
                        title="Закрыть (Esc)"
                        aria-label="Закрыть"
                    >
                        <X size={15} />
                    </button>
                </div>

                <div className="help-body">
                    {SHORTCUT_GROUPS.map((group) => (
                        <section className="help-group" key={group.title}>
                            <h3>{group.title}</h3>
                            {group.items.map((item, index) => (
                                <div className="help-row" key={`${group.title}-${index}`}>
                                    <span className="help-keys">
                                        {item.keys.map((key, index) => (
                                            <Fragment key={key}>
                                                {index > 0 && <span className="help-plus">+</span>}
                                                <kbd>{key}</kbd>
                                            </Fragment>
                                        ))}
                                    </span>
                                    <span className="help-text">{item.description}</span>
                                </div>
                            ))}
                        </section>
                    ))}
                </div>
            </div>
        </div>
    )
}
