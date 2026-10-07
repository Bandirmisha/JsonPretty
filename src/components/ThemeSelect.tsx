import { THEME_GROUPS, type ThemeId } from '../lib/themes'

type Props = {
    value: ThemeId
    onChange: (id: ThemeId) => void
}

export default function ThemeSelect({ value, onChange }: Props) {
    return (
        <div className="theme-block">
            <label htmlFor="themeSelect">Тема</label>
            <select
                id="themeSelect"
                value={value}
                onChange={(event) => onChange(event.target.value as ThemeId)}
            >
                {THEME_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                        {group.themes.map((theme) => (
                            <option key={theme.id} value={theme.id}>
                                {theme.label}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
        </div>
    )
}
