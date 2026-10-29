import { useEffect, useRef } from 'react'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, placeholder as cmPlaceholder } from '@codemirror/view'

type Props = {
    value: string
    onChange?: (value: string) => void
    /** Вызывается один раз при создании — для команд CodeMirror снаружи */
    onReady?: (view: EditorView) => void
    extensions: Extension[]
    className?: string
    /** Подсказка в пустом поле; меняется без пересоздания редактора */
    placeholder?: string
}

/**
 * Обёртка React над CodeMirror.
 *
 * Редактор создаётся один раз и дальше живёт сам: пересоздание сбрасывало бы
 * историю правок, позицию каретки и выделение. Внешние изменения значения
 * (шаблон, стирание) переносятся в документ отдельным эффектом.
 */
export default function CodeEditor({ value, onChange, onReady, extensions, className, placeholder }: Props) {
    const hostRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    /** Полный набор расширений с создания — нужен при пересоздании состояния */
    const configRef = useRef<Extension[] | null>(null)
    /** Последнее значение, которое редактор отдал наружу — чтобы не применять его обратно */
    const emittedRef = useRef<string | null>(null)
    const placeholderCompartment = useRef(new Compartment()).current

    // Колбэки живут в ref: они приходят новыми на каждый рендер, а редактор — один
    const onChangeRef = useRef(onChange)
    const onReadyRef = useRef(onReady)
    onChangeRef.current = onChange
    onReadyRef.current = onReady

    useEffect(() => {
        const host = hostRef.current
        if (!host) return

        const config: Extension[] = [
            ...extensions,
            placeholder
                ? placeholderCompartment.of(cmPlaceholder(placeholder))
                : placeholderCompartment.of([]),
            EditorView.updateListener.of((update) => {
                if (!update.docChanged) return

                const next = update.state.doc.toString()
                emittedRef.current = next
                onChangeRef.current?.(next)
            })
        ]
        configRef.current = config

        const view = new EditorView({
            parent: host,
            state: EditorState.create({ doc: value, extensions: config })
        })

        viewRef.current = view

        // Отдушина для тестов: даёт доступ к состоянию редактора напрямую,
        // без нажатий и фокуса окна. На поведение приложения не влияет.
        ;(host as HTMLDivElement & { cmView?: EditorView }).cmView = view

        onReadyRef.current?.(view)

        return () => {
            view.destroy()
            viewRef.current = null
            configRef.current = null
            delete (host as HTMLDivElement & { cmView?: EditorView }).cmView
        }
        // Расширения берём из первого рендера: они не должны меняться на лету,
        // иначе потеряются история и позиция. Пересоздание — только при размонтировании.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /**
     * Внешнее значение (шаблон, стирание) переносим пересозданием состояния: так не нужно
     * согласовывать прежнее выделение с новым текстом — именно на этом падала замена
     * через changes. Внутри кадра, чтобы не влезать в идущий flush CodeMirror.
     */
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const view = viewRef.current
            const config = configRef.current
            if (!view || !config) return
            if (view.state.doc.toString() === value || emittedRef.current === value) return

            view.setState(EditorState.create({ doc: value, extensions: config }))
        })

        return () => cancelAnimationFrame(frame)
    }, [value])

    // Подсказка зависит от выбранного формата ввода, но редактор остаётся тем же.
    // Обновляем и живое состояние, и сохранённый набор расширений: иначе после
    // внешней замены текста (шаблон, очистка) вернулась бы старая подсказка.
    useEffect(() => {
        const next = placeholder ? cmPlaceholder(placeholder) : []
        const config = configRef.current
        if (config) config[extensions.length] = placeholderCompartment.of(next)

        viewRef.current?.dispatch({
            effects: placeholderCompartment.reconfigure(next)
        })
    }, [placeholder, placeholderCompartment, extensions.length])

    return <div className={className} ref={hostRef} />
}
