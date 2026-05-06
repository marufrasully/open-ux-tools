import { join } from 'node:path';
import { promises } from 'node:fs';
import type { CdsEnvironment, NewI18nEntry } from '../../types';
import {
    getI18nConfiguration,
    resolveCapI18nFolderForFile,
    capPropertiesPath,
    printPropertiesI18nEntry,
    writeFile
} from '../../utils';
import { tryAddJsonTexts } from './json';
import { tryAddCsvTexts } from './csv';
import { tryAddPropertiesTexts } from './properties';
import type { Editor } from 'mem-fs-editor';

/**
 * A CAP i18n updater function — tries to add entries to an existing file and returns true on success.
 */
export type CapI18nUpdater = (
    env: CdsEnvironment,
    filePath: string,
    newI18nEntries: NewI18nEntry[],
    fs?: Editor
) => Promise<boolean>;

/**
 * Create new i18n entries to an existing file or in a new file if one does not exist.
 *
 * @param root project root, where i18n folder should reside if no i18n file exists
 * @param path absolute path to cds file for which translation should be maintained
 * @param newI18nEntries new i18n entries that will be maintained
 * @param env CDS environment configuration
 * @param fs optional `mem-fs-editor` instance. If provided, `mem-fs-editor` api is used instead of `fs` of node
 * @param updaters ordered list of write strategies to try; defaults to json, properties, csv
 * @returns boolean or exception
 * @description To create new entries, if tries:
 * ```markdown
 * 1. `.json` file
 * 2. `.properties` file, if failed for `.json` file
 * 3. `.csv` file if failed for `.properties` file
 * ```
 */
export async function createCapI18nEntries(
    root: string,
    path: string,
    newI18nEntries: NewI18nEntry[],
    env: CdsEnvironment,
    fs?: Editor,
    updaters: CapI18nUpdater[] = [tryAddJsonTexts, tryAddPropertiesTexts, tryAddCsvTexts]
): Promise<boolean> {
    const { baseFileName, folders } = getI18nConfiguration(env);
    const resolvedFolder = resolveCapI18nFolderForFile(root, env, path);
    const i18nFolderPath = resolvedFolder ?? join(root, folders[0]);
    if (!resolvedFolder && !fs) {
        // create directory when mem-fs-editor is not provided; mem-fs-editor creates it on `.commit()`
        await promises.mkdir(i18nFolderPath);
    }
    const filePath = join(i18nFolderPath, baseFileName);

    for (const update of updaters) {
        if (await update(env, filePath, newI18nEntries, fs)) {
            return true;
        }
    }

    // No existing i18n file found — create a new .properties file
    const newContent = newI18nEntries
        .map((entry) => printPropertiesI18nEntry(entry.key, entry.value, entry.annotation))
        .join('');
    await writeFile(capPropertiesPath(filePath, env), newContent, fs);
    return true;
}
