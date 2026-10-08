import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language'
import { forEachDiagnostic, linter, setDiagnosticsEffect, type Diagnostic } from '@codemirror/lint'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { createElement, type ComponentType } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import {
    EditorSelection,
    EditorState,
    Prec,
    RangeSet,
    StateEffect,
    StateField,
    type ChangeSpec,
    type Extension,
    type Line,
    type Range,
    type SelectionRange
} from '@codemirror/state'
import {
    Decoration,
    EditorView,
    GutterMarker,
    ViewPlugin,
    drawSelection,
    keymap,
    lineNumberMarkers,
    lineNumbers,
    placeholder as cmPlaceholder,
    rectangularSelection,
    type DecorationSet,
    type ViewUpdate
} from '@codemirror/view'
import { writeClipboard } from './clipboard'
import { findMatches } from './find'
import { tokenizeJson } from './highlight'

/* ---------- Подсветка JSON ----------
   Разборщик наш: он расставляет классы j-key, j-str, j-num и т.д., а цвета для них
   заданы в темах через CSS-переменные. Поэтому 18 тем работают как раньше,
   и отдельная тема CodeMirror не нужна. */

const jsonHighlight = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = tokenMarks(view)
        }

        update(update: ViewUpdate) {
            if (update.docChanged) this.decorations = tokenMarks(update.view)
        }
    },
    { decorations: (plugin) => plugin.decorations }
)

function tokenMarks(view: EditorView): DecorationSet {
    const text = view.state.doc.toString()
    const ranges: Range<Decoration>[] = tokenizeJson(text).map((token) =>
        Decoration.mark({ class: token.kind }).range(token.start, token.end)
    )

    // true — диапазоны уже отсортированы разборщиком
    return Decoration.set(ranges, true)
}

/* ---------- Подсветка совпадений поиска ----------
   Панель поиска у нас своя (FindBar), а подсветка CodeMirror рисуется только
   при открытой его собственной панели. Поэтому ведём запрос своим состоянием
   и красим совпадения теми же классами, что были до перехода на CodeMirror. */

export const setSearchHighlight = StateEffect.define<{ query: string; active: number }>()

const searchField = StateField.define<{ query: string; active: number }>({
    create: () => ({ query: '', active: -1 }),
    update(value, transaction) {
        for (const effect of transaction.effects) {
            if (effect.is(setSearchHighlight)) return effect.value
        }
        return value
    }
})

const searchHighlight = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = searchMarks(view)
        }

        update(update: ViewUpdate) {
            const changed = update.transactions.some((transaction) =>
                transaction.effects.some((effect) => effect.is(setSearchHighlight))
            )
            if (update.docChanged || changed) this.decorations = searchMarks(update.view)
        }
    },
    { decorations: (plugin) => plugin.decorations }
)

function searchMarks(view: EditorView): DecorationSet {
    const { query, active } = view.state.field(searchField)
    if (!query) return Decoration.none

    const text = view.state.doc.toString()
    const ranges: Range<Decoration>[] = findMatches(text, query).map((match, index) =>
        Decoration.mark({ class: index === active ? 'j-mark j-mark-active' : 'j-mark' }).range(
            match.start,
            match.end
        )
    )

    return Decoration.set(ranges, true)
}

/**
 * Ctrl+D — выделить следующее вхождение того же текста.
 * Своя команда, а не selectNextOccurrence из @codemirror/search: та требует
 * состояния его панели поиска, которая у нас не используется.
 */
function selectNextOccurrence(view: EditorView): boolean {
    const { state } = view
    const last = state.selection.ranges[state.selection.ranges.length - 1]

    // Каретка без выделения — сначала выделяем слово под ней, как в редакторах
    if (last.empty) {
        const text = state.doc.toString()
        const word = /[\w$]+/
        let start = last.from
        let end = last.to

        while (start > 0 && word.test(text[start - 1])) start--
        while (end < text.length && word.test(text[end])) end++
        if (start === end) return false

        view.dispatch({ selection: EditorSelection.single(start, end), scrollIntoView: true })
        return true
    }

    const text = state.sliceDoc(last.from, last.to)
    const next = state.doc.toString().indexOf(text, last.to)
    if (next === -1) return false

    view.dispatch({
        selection: state.selection.addRange(EditorSelection.range(next, next + text.length)),
        scrollIntoView: true
    })
    return true
}

/* ---------- Поведение ввода ----------
   Прежнее поле правила текст само: отступ в два пробела, автоотступ с разворотом
   блока, удаление пустой пары и целого отступа, вырезание строки. Набор команд
   ниже повторяет это поверх состояния CodeMirror, чтобы не тянуть старый слой. */

/** Отступ в поле ввода — два пробела, как в шаблоне группировки JSON. */
const INDENT = '  '

/**
 * Обходит строки, которые задевает выделение, и переносит само выделение
 * через сделанные правки: так мультикурсор и выделение блока остаются на месте.
 */
function eachSelectedLine(
    state: EditorState,
    range: SelectionRange,
    edit: (line: Line, changes: ChangeSpec[]) => void
) {
    const changes: ChangeSpec[] = []
    let done = -1

    for (let pos = range.from; pos <= range.to; ) {
        const line = state.doc.lineAt(pos)
        if (line.number > done && (range.empty || range.to > line.from)) {
            edit(line, changes)
            done = line.number
        }
        pos = line.to + 1
    }

    const set = state.changes(changes)
    return {
        changes,
        range: EditorSelection.range(set.mapPos(range.anchor, -1), set.mapPos(range.head, 1))
    }
}

/** Tab: вставить отступ, а на выделении — сдвинуть все его строки вправо. */
function indentCommand(view: EditorView): boolean {
    if (view.state.readOnly) return false

    view.dispatch(
        view.state.changeByRange((range) =>
            range.empty
                ? {
                      changes: { from: range.from, insert: INDENT },
                      range: EditorSelection.cursor(range.from + INDENT.length)
                  }
                : eachSelectedLine(view.state, range, (line, changes) => {
                      changes.push({ from: line.from, insert: INDENT })
                  })
        )
    )
    return true
}

/** Shift+Tab: снять отступ перед кареткой или по ступени с каждой строки выделения. */
function dedentCommand(view: EditorView): boolean {
    const { state } = view
    if (state.readOnly) return false

    let touched = false
    const tr = state.changeByRange((range) => {
        if (range.empty) {
            const line = state.doc.lineAt(range.from)
            const run = /[ \t]+$/.exec(state.sliceDoc(line.from, range.from))
            if (!run) return { range }

            const remove = Math.min(run[0].length, INDENT.length)
            touched = true
            return {
                changes: { from: range.from - remove, to: range.from },
                range: EditorSelection.cursor(range.from - remove)
            }
        }

        return eachSelectedLine(state, range, (line, changes) => {
            const leading = /^[ \t]+/.exec(line.text)
            if (!leading) return

            const remove = line.text.startsWith(INDENT) ? INDENT.length : leading[0].length
            touched = true
            changes.push({ from: line.from, to: line.from + remove })
        })
    })

    if (!touched) return false
    view.dispatch(tr)
    return true
}

/**
 * Backspace: целый отступ перед кареткой стирается за один шаг, но не уходит
 * за начало строки. Пустую пару символов удаляет команда автопар (она следующая
 * в раскладке), поэтому сюда она не попадает: перед кареткой там не пробел.
 */
function backspaceIndentCommand(view: EditorView): boolean {
    const { state } = view
    if (state.readOnly) return false

    let touched = false
    const tr = state.changeByRange((range) => {
        if (!range.empty) return { range }

        const line = state.doc.lineAt(range.from)
        const run = /[ \t]+$/.exec(state.sliceDoc(line.from, range.from))
        if (!run) return { range }

        touched = true
        return {
            changes: { from: range.from - run[0].length, to: range.from },
            range: EditorSelection.cursor(range.from - run[0].length)
        }
    })

    if (!touched) return false
    view.dispatch(tr)
    return true
}

/**
 * Ctrl+X без выделения: вырезается вся строка, на которой стоит каретка,
 * вместе с переводом строки — как в прежнем поле. Буфер заполняем сами.
 *
 * Обработчик висит на физической клавише (event.code), а не на имени из keymap:
 * на русской раскладке Ctrl+X даёт key = «ч», и привязка «Mod-x» не сработала бы.
 */
function cutLine(view: EditorView): boolean {
    const { state } = view
    if (state.readOnly) return false
    if (state.selection.ranges.some((range) => !range.empty)) return false

    const changes: ChangeSpec[] = []
    const parts: string[] = []
    let done = -1

    for (const range of state.selection.ranges) {
        const line = state.doc.lineAt(range.from)
        if (line.number === done) continue
        done = line.number

        let from = line.from
        let to = line.to
        if (to < state.doc.length) to += 1
        else if (from > 0) from -= 1

        parts.push(state.sliceDoc(from, to))
        changes.push({ from, to })
    }

    if (parts.length === 0) return false

    void writeClipboard(parts.join('\n'))
    view.dispatch({ changes, userEvent: 'delete.cut' })
    return true
}

/** Ctrl+X по физической клавише: раскладка не важна, «ч» на русской тоже сюда попадает. */
const cutLineKeydown = Prec.highest(
    EditorView.domEventHandlers({
        keydown(event, view) {
            if (!event.ctrlKey && !event.metaKey) return false
            if (event.altKey || event.code !== 'KeyX') return false
            return cutLine(view)
        }
    })
)

/* ---------- Ошибка разбора в гаттере ----------
   Отдельного гуттера с красным маркером нет: строку с ошибкой выдаёт подкраска
   её номера. Метка ставит класс на элемент номера строки. */

class ErrorLineMarker extends GutterMarker {
    elementClass = 'cm-error-line'
}

const errorLineMarker = new ErrorLineMarker()

function errorLineMarks(state: EditorState): RangeSet<GutterMarker> {
    const marks: Range<GutterMarker>[] = []
    let lastLine = -1

    forEachDiagnostic(state, (diagnostic) => {
        const line = state.doc.lineAt(Math.min(diagnostic.from, state.doc.length))
        if (line.number === lastLine) return

        lastLine = line.number
        marks.push(errorLineMarker.range(line.from))
    })

    return RangeSet.of(marks)
}

/** Метки пересчитываем, когда правят текст или приходит новый разбор ошибок. */
const errorLines = StateField.define<RangeSet<GutterMarker>>({
    create: errorLineMarks,
    update(value, transaction) {
        const changed =
            transaction.docChanged ||
            transaction.effects.some((effect) => effect.is(setDiagnosticsEffect))
        return changed ? errorLineMarks(transaction.state) : value
    },
    provide: (field) => lineNumberMarkers.from(field)
})

/**
 * Ошибка JSON.parse приходит с нулевой длиной, а CodeMirror рисует такие
 * диагностики точкой, а не подчёркиванием. Расширяем позицию до ближайшего
 * непробельного куска — тогда в поле появляется волнистое подчёркивание.
 */
function jsonLinter(view: EditorView): Diagnostic[] {
    return jsonParseLinter()(view).map((diagnostic) => {
        if (diagnostic.to > diagnostic.from) return diagnostic

        const doc = view.state.doc
        const line = doc.lineAt(diagnostic.from)
        const forward = /[^\s,}\]]+/.exec(doc.sliceString(diagnostic.from, line.to))

        if (forward) {
            return { ...diagnostic, to: diagnostic.from + forward[0].length }
        }

        const backward = /[^\s,}\]]+\s*$/.exec(doc.sliceString(line.from, diagnostic.from))
        if (backward) {
            return { ...diagnostic, from: diagnostic.from - backward[0].trimEnd().length }
        }

        return line.length ? { ...diagnostic, from: line.from, to: line.to } : diagnostic
    })
}

/**
 * SVG-разметка иконки lucide для императивного DOM CodeMirror. Рендерим синхронно
 * в отцепленный узел: иконка остаётся настоящей lucide, а серверный рендерер
 * (react-dom/server) в сборку не тянется.
 */
function iconMarkup(icon: ComponentType<{ size?: number }>, size: number): string {
    const host = document.createElement('div')
    const root = createRoot(host)
    flushSync(() => root.render(createElement(icon, { size })))
    const markup = host.innerHTML
    root.unmount()
    return markup
}

/** Стрелки сворачивания — иконки lucide, собранные в SVG-разметку один раз. */
const FOLD_ICONS: Record<'open' | 'closed', string> = {
    open: iconMarkup(ChevronDown, 16),
    closed: iconMarkup(ChevronRight, 16)
}

/** Узел стрелки для гаттера: открыто — вниз, свёрнуто — вправо. */
function foldArrow(open: boolean): HTMLElement {
    const arrow = document.createElement('span')
    arrow.className = 'cm-fold-arrow'
    arrow.innerHTML = open ? FOLD_ICONS.open : FOLD_ICONS.closed
    return arrow
}

/* ---------- Блочное (столбцовое) выделение ----------
   Как в Rider и VS Code: зажатая средняя кнопка мыши и протяжка проставляют
   каретки по вертикали, а движение вбок выделяет символы столбцом.
   Alt+протяжка слева — то же самое, это поведение CodeMirror по умолчанию. */
const rectangular = rectangularSelection({
    eventFilter: (event) => event.button === 1 || (event.button === 0 && event.altKey)
})

/**
 * Средняя кнопка в Chromium на Windows включает автопрокрутку (кружок со стрелками):
 * она перехватывает протяжку и ломает блочное выделение. В приложении она выключена
 * флагом MiddleClickAutoscroll, но обработчик нужен и сам по себе — он гасит действие
 * по умолчанию, если приложение открыто в обычном браузере.
 *
 * Слушатель висит на корне редактора вручную, а не через EditorView.domEventHandlers:
 * CodeMirror прерывает свою цепочку обработчиков, если действие события уже отменено,
 * поэтому отменять его можно только после того, как выделение началось.
 */
const middleButtonGuard = ViewPlugin.fromClass(
    class {
        private readonly host: HTMLElement

        private readonly onMouseDown = (event: MouseEvent) => {
            if (event.button === 1) event.preventDefault()
        }

        constructor(view: EditorView) {
            this.host = view.dom
            this.host.addEventListener('mousedown', this.onMouseDown)
        }

        destroy() {
            this.host.removeEventListener('mousedown', this.onMouseDown)
        }
    }
)

export type SetupOptions = {
    /** Панель только для чтения: результат, который нельзя править */
    readOnly?: boolean
    /** Номера строк в гаттере. В «Результате» они не нужны */
    lineNumbers?: boolean
    /** Переносить длинные строки вместо горизонтальной прокрутки */
    wrap?: boolean
    placeholder?: string
}

/** Общий набор расширений для обеих панелей */
export function cmSetup({
    readOnly,
    lineNumbers: showLineNumbers = true,
    wrap,
    placeholder
}: SetupOptions = {}): Extension[] {
    const extensions: Extension[] = [
        // Сначала номер строки, сразу справа от него — стрелка сворачивания
        ...(showLineNumbers ? [lineNumbers(), errorLines] : []),
        foldGutter({ markerDOM: foldArrow }),
        drawSelection(),
        // Мультикурсор: несколько выделений/кареток.
        // Alt+клик (как в VS Code) добавляет каретку; Ctrl/⌘+клик оставляем как
        // стандарт CodeMirror — по умолчанию на Windows он был бы только Ctrl.
        EditorState.allowMultipleSelections.of(true),
        EditorView.clickAddsSelectionRange.of(
            (event) => event.altKey || event.ctrlKey || event.metaKey
        ),
        // Блочное выделение средней кнопкой мыши
        rectangular,
        middleButtonGuard,
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        json(),
        jsonHighlight,
        searchField,
        searchHighlight,
        cutLineKeydown,
        keymap.of([
            // Ctrl+D — выделить следующее вхождение выделенного текста
            { key: 'Mod-d', run: selectNextOccurrence, preventDefault: true },
            // Tab и Shift+Tab — свой отступ: два пробела от каретки, сдвиг блока
            { key: 'Tab', run: indentCommand, shift: dedentCommand },
            // Backspace на отступе — стереть его целиком
            { key: 'Backspace', run: backspaceIndentCommand },
            ...closeBracketsKeymap,
            ...foldKeymap,
            ...historyKeymap,
            ...defaultKeymap
        ]),
        EditorView.editable.of(!readOnly)
    ]

    if (wrap) extensions.push(EditorView.lineWrapping)

    if (readOnly) {
        extensions.push(EditorState.readOnly.of(true))
    } else {
        // Разбор ошибок JSON: строка с ошибкой подсвечивается в гаттере,
        // а сама ошибка — волнистым подчёркиванием в тексте
        extensions.push(history(), linter(jsonLinter, { delay: 250 }))
    }

    if (placeholder) extensions.push(cmPlaceholder(placeholder))

    return extensions
}
