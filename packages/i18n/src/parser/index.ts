import { FileFormat } from './types';
import type { ParseResult } from './types';
import { parseProperties } from './properties/parser';
import { parseCsv } from './csv/parser';

type Parser = (text: string) => ParseResult;

const parsers: Partial<Record<FileFormat, Parser>> = {
    [FileFormat.properties]: parseProperties,
    [FileFormat.csv]: parseCsv
};

/**
 * Parse text.
 *
 * @param text text
 * @param format extension format
 * @returns parse result
 */
export function parse(text: string, format: FileFormat): ParseResult {
    const parser = parsers[format];
    if (!parser) {
        throw new Error(`Unsupported file format: ${format}`);
    }
    return parser(text);
}
