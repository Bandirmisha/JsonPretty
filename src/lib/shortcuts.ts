export type Shortcut = {
    keys: string[]
    description: string
    showPlus?: boolean
}

export type ShortcutGroup = {
    title: string
    items: Shortcut[]
}

export type HelpItem = {
    /** Короткая метка: тип, атрибут, значение */
    label?: string
    text: string
}

export type HelpNote = {
    title?: string
    text?: string
    /** Перечисление — рисуется списком, а не «кашей» в абзаце */
    items?: HelpItem[]
    /** Пример кода под пояснением */
    code?: string
}

export type HelpSection = {
    title: string
    notes: HelpNote[]
}

/** Хоткеи и пояснения для окна «Справка». Состав соответствует реальному поведению поля «Ввод». */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
    {
        title: 'Ввод',
        items: [
            { keys: ['"', '{', '['], description: 'На выделении — обернуть его в символ', showPlus: false },
            { keys: ['Tab'], description: 'Отступ в два пробела; на выделении — сдвинуть блок' },
            { keys: ['Shift', 'Tab'], description: 'Убрать отступ' },
            { keys: ['Ctrl', 'X'], description: 'Без выделения — вырезать строку' },
        ]
    },
    {
        title: 'Мультикурсор',
        items: [
            { keys: ['Ctrl', 'D'], description: 'Выделить следующее вхождение того же текста' },
            { keys: ['Alt', 'клик'], description: 'Добавить ещё одну каретку' },
            { keys: ['Средняя кнопка мыши'], description: 'Протяжка — блочное выделение по столбцам'}
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
    },
    {
        title: 'Изменения',
        items: [
            { keys: ['Ctrl', 'Z'], description: 'Отменить последнюю правку' },
            { keys: ['Ctrl', 'Y'], description: 'Вернуть последнюю правку' }
        ]
    },
]

/** Пояснения «как это работает» — в отличие от хоткеев, без клавиш. */
export const HELP_SECTIONS: HelpSection[] = [
    {
        title: 'JSON',
        notes: [
            {
                title: 'Варианты ввода',
                items: [
                    { label: 'JSON', text: 'обычный объект или массив' },
                    { label: 'JSONL', text: 'несколько значений, по одному на строку' },
                    { label: 'JSON в строке', text: 'например, `"{\\"a\\":1}"`' },
                    {
                        label: 'Либеральный JSON',
                        text: 'одинарные кавычки, ключи без кавычек, висячие запятые'
                    },
                    { label: 'Текст вокруг JSON', text: 'берётся первый объект или массив' }
                ],
                code: "{ name: 'Анна', age: 30, tags: ['a', 'b',], }"
            }
        ]
    },
    {
        title: 'C#',
        notes: [
            {
                title: 'Варианты ввода',
                items: [
                    { label: 'Один класс', text: '`class`, `struct` или `record`' },
                    {
                        label: 'Целый файл',
                        text: '`using`, `namespace` и комментарии можно не убирать'
                    },
                    {
                        label: 'Только поля',
                        text: 'список полей/свойств без имени класса и `{}`'
                    },
                    {
                        label: 'Вложенность и наследование',
                        text: 'вложенные типы и наследование от класса из этого же файла'
                    }
                ],
                code: `using System.Text.Json.Serialization;

namespace MyApp.Models;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}`
            },
            {
                title: 'Атрибуты имён',
                text: 'Имя поля JSON берётся из атрибута:',
                items: [
                    { label: '[JsonProperty("имя")]', text: 'Newtonsoft.Json' },
                    {
                        label: '[JsonProperty(PropertyName = "имя")]',
                        text: 'Newtonsoft.Json'
                    },
                    { label: '[JsonPropertyName("имя")]', text: 'System.Text.Json' },
                    { label: '[JsonIgnore]', text: 'исключает поле в любом случае' }
                ],
                code: `public class User
{
    [JsonProperty("user_id")]
    public int Id { get; set; }

    [JsonPropertyName("full_name")]
    public string Name { get; set; }

    [JsonIgnore]
    public string Password { get; set; }
}`
            },
            {
                title: 'Когда атрибуты включены',
                items: [
                    {
                        text:
                            'если в классе есть хотя бы один `JsonProperty` или `JsonPropertyName` — ' +
                            'в JSON попадают только помеченные поля'
                    },
                    { text: 'если атрибут без имени — остаётся имя поля' },
                    {
                        text:
                            'если атрибутов нет — все public-поля пишутся под своими именами'
                    }
                ]
            },
            {
                title: 'Значения по умолчанию',
                items: [
                    { label: 'int, long, double, decimal', text: '→ `0`' },
                    { label: 'bool', text: '→ `false`' },
                    { label: 'string, char', text: '→ `""`' },
                    { label: 'DateTime', text: '→ `"0001-01-01T00:00:00"`' },
                    {
                        label: 'DateTimeOffset',
                        text: '→ `"0001-01-01T00:00:00+00:00"`'
                    },
                    { label: 'DateOnly', text: '→ `"0001-01-01"`' },
                    { label: 'TimeOnly, TimeSpan', text: '→ `"00:00:00"`' },
                    {
                        label: 'Guid',
                        text: '→ `"00000000-0000-0000-0000-000000000000"`'
                    },
                    { label: 'enum', text: '→ `0`' },
                    { label: 'nullable', text: '→ `null`' },
                    {
                        label: 'Коллекции и массивы',
                        text: 'заполняются одним элементом, чтобы был виден формат вложенных данных'
                    },
                    { label: 'byte[]', text: '→ base64-строка `""`' },
                    { label: 'Словари', text: '→ `{}`' },
                    { label: 'Вложенные классы', text: 'раскрываются объектами' },
                    { label: 'Самоссылки', text: 'обрываются пустым объектом `{}`' }
                ],
                code: `public class Order
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<Item> Items { get; set; } = new();
}

// Результат: 
// { 
//   "Id": 0, 
//   "CreatedAt": "0001-01-01T00:00:00", 
//   "Items": [ { ... } ] 
// }`
            },
            {
                title: 'Несколько классов',
                text: 'Если введено несколько типов, приложение выбирает один корневой:',
                items: [
                    { label: 'Один тип', text: 'он сразу становится корневым' },
                    {
                        label: 'Несколько типов',
                        text:
                            'корнем становится тот, который не используется как тип полей других ' +
                            'классов; остальные раскрываются внутри него'
                    },
                    {
                        label: 'Равноправные типы',
                        text: 'если на типы никто не ссылается, берётся первый по порядку в файле'
                    },
                    {
                        label: 'Самоссылки',
                        text:
                            'если все классы ссылаются друг на друга, выбирается тот, у которого ' +
                            'больше связей с другими классами; при равенстве — первый'
                    },
                    {
                        label: 'Вложенные типы',
                        text: 'не участвуют в выборе корня и раскрываются там, где на них ссылаются'
                    },
                    {
                        label: 'Интерфейсы и enum',
                        text: 'корнем не становятся; enum даёт значение `0`'
                    },
                    {
                        label: 'Другой корень',
                        text: 'вставьте нужный класс отдельно или поставьте его первым в файле'
                    }
                ],
                code: `public class Address
{
    public string City { get; set; }
}

public class User
{
    public Address Address { get; set; }
    public string Name { get; set; }
}

// Результат:
// Корень — User, Address раскроется внутри:
// {
//   "Address": { "City": "" },
//   "Name": ""
// }`
            },
            {
                title: 'Ограничения',
                items: [
                    { text: 'значения по умолчанию не учитывают инициализаторы полей' },
                    { text: 'неизвестные типы из других сборок дают `null`' },
                    { text: 'приватные поля без атрибутов не попадают в JSON' }
                ]
            }
        ]
    }
]
