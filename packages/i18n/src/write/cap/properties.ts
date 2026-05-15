import type { CdsEnvironment, NewI18nEntry } from '../../types';
import { capPropertiesPath, doesExist, nodeFsBackend } from '../../utils';
import type { StorageBackend } from '../../utils';
import { writeToExistingI18nPropertiesFile } from '../utils';

/**
 * Add i18n entries to respective i18n file.
 *
 * @description It first tries to add to an existing `.properties` file, it it does not exist, it tries to add to `.csv` file,
 * if it fails, it generates new `.properties` file with new i18n entries.
 * @param env cds environment
 * @param path file path
 * @param newI18nEntries new i18n entries that will be maintained
 * @param backend storage backend to use. Defaults to Node.js `fs/promises`.
 * @returns boolean
 */
export async function tryAddPropertiesTexts(
    env: CdsEnvironment,
    path: string,
    newI18nEntries: NewI18nEntry[],
    backend: StorageBackend = nodeFsBackend
): Promise<boolean> {
    const i18nFilePath = capPropertiesPath(path, env);
    if (!(await doesExist(i18nFilePath, backend))) {
        return false;
    }
    return writeToExistingI18nPropertiesFile(i18nFilePath, newI18nEntries, [], backend);
}
