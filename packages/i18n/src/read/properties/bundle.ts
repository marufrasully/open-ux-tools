import type { I18nBundle } from '../../types';
import { propertiesToI18nEntry } from '../../transformer/properties';
import { nodeFsBackend, readFile } from '../../utils';
import type { StorageBackend } from '../../utils';

/**
 * Gets i18n bundle for `.properties` file.
 *
 * @param i18nFilePath absolute path to `i18n.properties` file
 * @param backend storage backend to use. Defaults to Node.js `fs/promises`.
 * @returns i18n bundle or exception
 */
export async function getPropertiesI18nBundle(
    i18nFilePath: string,
    backend: StorageBackend = nodeFsBackend
): Promise<I18nBundle> {
    const bundle: I18nBundle = {};
    const content = await readFile(i18nFilePath, backend);
    const ast = propertiesToI18nEntry(content, i18nFilePath);
    for (const entry of ast) {
        if (!bundle[entry.key.value]) {
            bundle[entry.key.value] = [];
        }
        bundle[entry.key.value].push(entry);
    }

    return bundle;
}
