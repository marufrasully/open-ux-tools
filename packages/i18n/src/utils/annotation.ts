import type { SapTextType } from '../types';
import { SapLongTextType, SapShortTextType } from '../types';

/**
 * Get the calculated maximum text length for an i18n property value.
 *
 * @param value - Value of the i18n property
 * @returns max length for a given value
 * @description The algorithm considers the current UI5 specification.
 */
export function getI18nMaxLength(value: string): number {
    const iLength = value.length;
    if (iLength < 8) {
        return iLength * 5;
    }
    if (iLength <= 30) {
        return iLength * 3;
    }
    return iLength * 1.5;
}

/**
 * Get a suitable textType for an i18n property.
 *
 * @param maxLength - Maximum text length of the i18n property value
 * @returns returns text type
 * @description The textType is derived from the maximum text length maxLength of the property value.
 */
export function getI18nTextType(maxLength: number): SapTextType {
    if (maxLength <= 120) {
        return SapShortTextType.Label;
    }
    return SapLongTextType.MessageText;
}

/**
 * Derive the SAP annotation prefix character for a string annotation.
 * Delegates to getI18nTextType so the short/long text boundary is defined once.
 *
 * @param text - i18n entry value
 * @returns 'X' for short text (≤ threshold), 'Y' for long text
 */
export function getAnnotationPrefix(text: string): 'X' | 'Y' {
    return getI18nTextType(text.length) === SapShortTextType.Label ? 'X' : 'Y';
}
