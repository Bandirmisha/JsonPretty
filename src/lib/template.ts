/**
 * Небольшой шаблон JSON со всеми базовыми типами значений:
 * строка, число, boolean, массив, объект.
 */
export const JSON_TEMPLATE = {
    string: 'строка',
    number: 42,
    boolean: true,
    array: [],
    object: {}
}

export function templateText(): string {
    return JSON.stringify(JSON_TEMPLATE, null, 2)
}

/** Заготовка C#-класса для режима «C# → JSON». */
export function csharpTemplateText(): string {
    return `public class Example
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool Active { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<string> Tags { get; set; } = new();
}`
}
