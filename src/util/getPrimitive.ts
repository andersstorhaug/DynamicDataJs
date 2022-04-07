export function getPrimitive(value: any) {
    if (value == null) return '';

    switch (typeof value) {
        case 'object':
        case 'function':
            return value.toString();
        case 'symbol':
            return String(value);
        default:
            return value;
    }
}
