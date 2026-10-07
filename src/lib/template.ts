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
