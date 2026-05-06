import type { I18nBundle, I18nEntry } from './../types';

/**
 * Uniform key-existence contract over both I18nEntry[] and I18nBundle.
 */
export interface KeyedI18nLookup {
    hasKey(key: string): boolean;
}

/**
 * Adapt an I18nEntry[] or I18nBundle to the KeyedI18nLookup interface.
 *
 * @param data array of i18n entries or an i18n bundle map
 * @returns KeyedI18nLookup adapter
 */
export function toKeyedLookup(data: I18nEntry[] | I18nBundle): KeyedI18nLookup {
    if (Array.isArray(data)) {
        return { hasKey: (key) => data.some((item) => item.key.value === key) };
    }
    return { hasKey: (key) => data[key] !== undefined };
}

/**
 * Extract i18n key.
 *
 * @param input input content
 * @param key i18n key used. Default is `i18n`
 * @returns extracted key
 */
export function extractI18nKey(input: string, key = 'i18n'): string {
    const sanitizedInput = input.trim();
    const regPattern = new RegExp(`^({@?${key}(>|&gt;))`, 'g');
    return sanitizedInput.replace(regPattern, '').replace(/\}$/gm, '').trim();
}

/**
 * Checks if a string starts with '{{' and ends with '}}'.
 *
 * @param input input string to check.
 * @returns  boolean
 */
function doesDoubleCurlyBracketsExist(input: string): boolean {
    return input.startsWith('{{') && input.endsWith('}}');
}

/**
 * Extracts double curly brackets key from the given input.
 *
 * @param input string to extract the double curly brackets key from
 * @returns extracted key or undefined if open and closing double curly bracket does not exist
 */
export function extractDoubleCurlyBracketsKey(input: string): string | undefined {
    const data = input.trim();
    if (!doesDoubleCurlyBracketsExist(data)) {
        return undefined;
    }
    return data.substring(2, data.length - 2).trim();
}

/**
 * Get unique key. If the key is not unique, it increment key by one and recheck.
 *
 * @param key new key and it is incremented
 * @param i18nData I18n entries or bundle — or a pre-adapted KeyedI18nLookup
 * @param originalKey original key without any index increment
 * @param counter counter for increment
 * @returns unique key
 */
export function getI18nUniqueKey(
    key: string,
    i18nData: I18nEntry[] | I18nBundle | KeyedI18nLookup,
    originalKey = key,
    counter = 1
): string {
    const lookup: KeyedI18nLookup =
        typeof (i18nData as KeyedI18nLookup).hasKey === 'function'
            ? (i18nData as KeyedI18nLookup)
            : toKeyedLookup(i18nData as I18nEntry[] | I18nBundle);

    if (lookup.hasKey(key)) {
        return getI18nUniqueKey(`${originalKey}${counter}`, lookup, originalKey, counter + 1);
    }
    return key;
}
