export type Shortcut = {
    keys: string[]
    description: string
}

export type ShortcutGroup = {
    title: string
    items: Shortcut[]
}

/** Хоткеи и пояснения для окна «Справка». Состав соответствует реальному поведению поля «Ввод». */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
    {
        title: 'Ввод',
        items: [
            { keys: ['"'], description: 'На выделении — обернуть его в кавычки' },
            { keys: ['Ctrl', 'X'], description: 'Без выделения — вырезать строку'},
            { keys: ['Ctrl', 'Z'], description: 'Отменить последнюю правку' }
        ]
    },
    {
        title: 'Поиск',
        items: [
            { keys: ['Ctrl', 'F'], description: 'Открыть поиск' },
            { keys: ['Enter'], description: 'В строке поиска - Следующее совпадение' },
            { keys: ['Shift', 'Enter'], description: 'В строке поиска - Предыдущее совпадение' },
            { keys: ['Esc'], description: 'Закрыть поиск' }
        ]
    }
]
