import { Fragment, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { SHORTCUT_GROUPS, HELP_SECTIONS } from '../lib/shortcuts'

type HelpTab = 'shortcuts' | 'how'

/** Текст с `кодом` в обратных кавычках: код рисуется моноширинным. */
function InlineText({ text }: { text: string }) {
    const parts = text.split(/(`[^`]+`)/g)
    return (
        <>
            {parts.map((part, index) =>
                part.startsWith('`') && part.endsWith('`') ? (
                    <code className="help-inline" key={index}>
                        {part.slice(1, -1)}
                    </code>
                ) : (
                    <Fragment key={index}>{part}</Fragment>
                )
            )}
        </>
    )
}

type Props = {
    open: boolean
    onClose: () => void
}

export default function HelpDialog({ open, onClose }: Props) {
    const closeRef = useRef<HTMLButtonElement>(null)
    const dialogRef = useRef<HTMLDivElement>(null)
    const bodyRef = useRef<HTMLDivElement>(null)
    const [tab, setTab] = useState<HelpTab>('shortcuts')

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

    // При смене раздела справка открывается с начала
    useEffect(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = 0
    }, [tab])

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
                    <div className="help-tabs" role="tablist" aria-label="Раздел справки">
                        <button
                            id="help-tab-shortcuts"
                            type="button"
                            role="tab"
                            aria-selected={tab === 'shortcuts'}
                            aria-controls="help-panel"
                            className={`help-tab${tab === 'shortcuts' ? ' is-active' : ''}`}
                            onClick={() => setTab('shortcuts')}
                        >
                            Горячие клавиши
                        </button>
                        <button
                            id="help-tab-how"
                            type="button"
                            role="tab"
                            aria-selected={tab === 'how'}
                            aria-controls="help-panel"
                            className={`help-tab${tab === 'how' ? ' is-active' : ''}`}
                            onClick={() => setTab('how')}
                        >
                            Принцип работы
                        </button>
                    </div>
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

                <div
                    className="help-body"
                    id="help-panel"
                    role="tabpanel"
                    aria-labelledby={`help-tab-${tab}`}
                    ref={bodyRef}
                >
                    {tab === 'shortcuts'
                        ? SHORTCUT_GROUPS.map((group) => (
                              <section className="help-group" key={group.title}>
                                  <h3>{group.title}</h3>
                                  {group.items.map((item, index) => (
                                      <div className="help-row" key={`${group.title}-${index}`}>
                                          <span className="help-keys">
                                              {item.keys.map((key, index) => (
                                                  <Fragment key={key}>
                                                      {index > 0 && (item.showPlus !== false
                                                              ? <span className="help-plus">+</span> 
                                                              : <span className="help-plus">,</span>)}
                                                      <kbd>{key}</kbd>
                                                  </Fragment>
                                              ))}
                                          </span>
                                          <span className="help-text">{item.description}</span>
                                      </div>
                                  ))}
                              </section>
                          ))
                        : HELP_SECTIONS.map((section) => (
                              <section className="help-group help-group-format" key={section.title}>
                                  <h3>{section.title}</h3>
                                  {section.notes.map((note, index) => (
                                      <div className="help-note" key={`${section.title}-${index}`}>
                                          {note.title && <h4>{note.title}</h4>}
                                          {note.text && (
                                              <p>
                                                  <InlineText text={note.text} />
                                              </p>
                                          )}
                                          {note.items && (
                                              <ul className="help-list">
                                                  {note.items.map((item, itemIndex) => (
                                                      <li key={itemIndex}>
                                                          {item.label && (
                                                              <code className="help-inline">{item.label}</code>
                                                          )}
                                                          {item.label &&
                                                              (item.text.trimStart().startsWith('→')
                                                                  ? ' '
                                                                  : ' — ')}
                                                          <InlineText text={item.text} />
                                                      </li>
                                                  ))}
                                              </ul>
                                          )}
                                          {note.code && <pre className="help-code">{note.code}</pre>}
                                      </div>
                                  ))}
                              </section>
                          ))}
                </div>
            </div>
        </div>
    )
}
