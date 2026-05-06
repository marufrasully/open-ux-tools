import type { NewI18nEntry } from '../../types';
import { printPropertiesI18nEntry, readFile, writeFile, doesExist } from '../../utils';
import type { Editor } from 'mem-fs-editor';
import { Range, TextEdit } from '@sap-ux/text-document-utils';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseProperties } from '../../parser/properties/parser';

/**
 * Read a file, apply a pure transform, and write the result back.
 * Returns false without touching the filesystem if the file does not exist.
 *
 * @param filePath absolute path to the file
 * @param transform pure function that converts current content to new content
 * @param fs optional `mem-fs-editor` instance
 * @returns boolean
 */
export async function tryUpdateFile(
    filePath: string,
    transform: (content: string) => string,
    fs?: Editor
): Promise<boolean> {
    if (!(await doesExist(filePath))) {
        return false;
    }
    const content = await readFile(filePath, fs);
    await writeFile(filePath, transform(content), fs);
    return true;
}

/**
 * If keys to remove are provided, they will be removed from the file before writing new entries.
 *
 * @param i18nFilePath i18n file path
 * @param newI18nEntries  new i18n entries that will be maintained
 * @param keysToRemove - Array of keys to remove from the file.
 * @param fs optional `mem-fs-editor` instance. If provided, `mem-fs-editor` api is used instead of `fs` of node
 * @returns boolean
 */
export async function writeToExistingI18nPropertiesFile(
    i18nFilePath: string,
    newI18nEntries: NewI18nEntry[],
    keysToRemove: string[] = [],
    fs?: Editor
): Promise<boolean> {
    let content = await readFile(i18nFilePath, fs);
    if (keysToRemove.length) {
        content = removeKeysFromI18nPropertiesFile(content, keysToRemove);
    }
    const addition = prependGapIfNeeded(content, formatNewEntries(newI18nEntries));
    await writeFile(i18nFilePath, content.concat(addition), fs);
    return true;
}

/**
 * Formats an array of new i18n entries into a properties file string.
 *
 * @param entries new i18n entries
 * @returns formatted string
 */
function formatNewEntries(entries: NewI18nEntry[]): string {
    return entries.map((entry) => printPropertiesI18nEntry(entry.key, entry.value, entry.annotation)).join('');
}

/**
 * Prepends a blank gap line to `addition` when `existing` does not end with a newline.
 *
 * @param existing current file content
 * @param addition new content to append
 * @returns addition, optionally prefixed with `\n`
 */
function prependGapIfNeeded(existing: string, addition: string): string {
    const lines = existing.split(/\r\n|\n/);
    if (lines.length > 0 && lines[lines.length - 1].trim()) {
        return `\n${addition}`;
    }
    return addition;
}

/**
 * Removes i18n entries from an existing i18n.properties file.
 *
 * @param content content of the i18n.properties file.
 * @param keysToRemove Array of keys to remove from the file.
 * @returns string
 */
function removeKeysFromI18nPropertiesFile(content: string, keysToRemove: string[]): string {
    const document = TextDocument.create('', '', 0, content);
    const textEdits: TextEdit[] = [];
    const { ast } = parseProperties(content);

    for (let i = 0; i < ast.length; i++) {
        const line = ast[i];
        if (line.type === 'key-element-line' && keysToRemove.findIndex((key) => line.key.value.includes(key)) !== -1) {
            const previousLine = ast[i - 1];
            const start = previousLine.type === 'comment-line' ? previousLine.range.start : line.range.start;
            const end = line.endOfLineToken ? document.positionAt(line.endOfLineToken.end) : line.range.end;
            textEdits.push(TextEdit.del(Range.create(start, end)));
        }
    }
    return TextDocument.applyEdits(document, textEdits).trim();
}
