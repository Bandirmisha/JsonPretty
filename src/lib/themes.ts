export type ThemeId =
    | 'vs-dark'
    | 'vs-light'
    | 'dracula'
    | 'one-dark'
    | 'monokai'
    | 'nord'
    | 'tokyo-night'
    | 'gruvbox-dark'
    | 'catppuccin-mocha'
    | 'solarized-light'
    | 'white'
    | 'everforest-light'
    | 'catppuccin-latte'
    | 'everforest-dark'
    | 'rose-pine'
    | 'synthwave-84'
    | 'oceanic-next'
    | 'rose-pine-dawn'

export type ThemeOption = {
    id: ThemeId
    label: string
}

export type ThemeGroup = {
    label: string
    themes: ThemeOption[]
}

export const THEME_GROUPS: ThemeGroup[] = [
    {
        label: 'Тёмные',
        themes: [
            { id: 'vs-dark', label: 'Visual Studio Dark' },
            { id: 'dracula', label: 'Dracula' },
            { id: 'one-dark', label: 'One Dark Pro' },
            { id: 'monokai', label: 'Monokai' },
            { id: 'nord', label: 'Nord' },
            { id: 'tokyo-night', label: 'Tokyo Night' },
            { id: 'gruvbox-dark', label: 'Gruvbox Dark' },
            { id: 'catppuccin-mocha', label: 'Catppuccin Mocha' },
            { id: 'everforest-dark', label: 'Everforest' },
            { id: 'oceanic-next', label: 'Oceanic' },
            { id: 'rose-pine', label: 'Rosé Pine' },
            { id: 'synthwave-84', label: "Synthwave '84" }
        ]
    },
    {
        label: 'Светлые',
        themes: [
            { id: 'vs-light', label: 'Visual Studio Light' },
            { id: 'white', label: 'White' },
            { id: 'solarized-light', label: 'Solarized Light' },
            { id: 'everforest-light', label: 'Everforest Light' },
            { id: 'catppuccin-latte', label: 'Catppuccin Latte' },
            { id: 'rose-pine-dawn', label: 'Rosé Pine Dawn' }
        ]
    }
]

export const THEMES: ThemeOption[] = THEME_GROUPS.flatMap((group) => group.themes)

export const DEFAULT_THEME: ThemeId = 'vs-dark'
export const THEME_STORAGE_KEY = 'jsonpretty.theme'

export function isThemeId(value: unknown): value is ThemeId {
    return THEMES.some((theme) => theme.id === value)
}

export function themeLabel(id: ThemeId): string {
    return THEMES.find((theme) => theme.id === id)?.label ?? id
}

/** Читает тему из localStorage; при любой проблеме возвращает тему по умолчанию. */
export function loadTheme(): ThemeId {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY)
        return isThemeId(stored) ? stored : DEFAULT_THEME
    } catch {
        return DEFAULT_THEME
    }
}

export function saveTheme(id: ThemeId): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, id)
    } catch {
        /* приватный режим и т.п. — просто не сохраняем */
    }
}
