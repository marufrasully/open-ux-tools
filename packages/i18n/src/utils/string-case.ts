/**
 * Convert to camel case. It gets text like 'product details info' and convert it to 'productDetailsInfo'.
 *
 * @param text text
 * @param maxWord maximal word
 * @returns camel case text
 */
export function convertToCamelCase(text = '', maxWord = 4): string {
    let output = '';
    const parts = text
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .trim()
        .split(' ');
    const len = parts.length >= maxWord ? maxWord : parts.length;
    for (let i = 0; len > i; i++) {
        const part = parts[i];
        if (i === 0) {
            output += part.toLowerCase();
        } else {
            const initial = part.charAt(0).toUpperCase();
            const rest = part.substring(1).toLowerCase();
            output += `${initial}${rest}`;
        }
    }

    return output;
}

/**
 * Convert to pascal case. It gets text like 'product details info' and convert it to 'ProductDetailsInfo'.
 *
 * @param text text
 * @param maxWord maximal word
 * @returns pascal case text
 */
export function convertToPascalCase(text: string, maxWord = 4): string {
    let output = '';
    const parts = text
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .trim()
        .split(' ');
    const len = parts.length >= maxWord ? maxWord : parts.length;
    for (let i = 0; len > i; i++) {
        const part = parts[i];
        const initial = part.charAt(0).toUpperCase();
        const rest = part.substring(1).toLowerCase();
        output += `${initial}${rest}`;
    }

    return output;
}
