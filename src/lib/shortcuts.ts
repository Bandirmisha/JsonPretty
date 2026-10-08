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
            { keys: ['Tab'], description: 'Отступ в два пробела; на выделении — сдвинуть блок' },
            { keys: ['Shift', 'Tab'], description: 'Убрать отступ' },
            { keys: ['Enter'], description: 'Новая строка с автоотступом; между скобками — развернуть блок' },
            { keys: ['Ctrl', 'X'], description: 'Без выделения — вырезать строку' },
            { keys: ['Ctrl', 'Z'], description: 'Отменить последнюю правку' }
        ]
    },
    {
        title: 'Мультикурсор и сворачивание',
        items: [
            { keys: ['Ctrl', 'D'], description: 'Выделить следующее вхождение того же текста' },
            { keys: ['Alt', 'клик'], description: 'Добавить ещё одну каретку' },
            { keys: ['Средняя кнопка'], description: 'Протяжка — блочное выделение по столбцам'}
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
