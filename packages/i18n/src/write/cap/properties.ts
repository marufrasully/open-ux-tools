import type { CdsEnvironment, NewI18nEntry } from '../../types';
import { capPropertiesPath, doesExist } from '../../utils';
import { writeToExistingI18nPropertiesFile } from '../utils';
import type { Editor } from 'mem-fs-editor';

/**
 * Add i18n entries to respective i18n file.
 *
 * @description It first tries to add to an existing `.properties` file, it it does not exist, it tries to add to `.csv` file,
 * if it fails, it generates new `.properties` file with new i18n entries.
 * @param env cds environment
 * @param path file path
 * @param newI18nEntries new i18n entries that will be maintained
 * @param fs optional `mem-fs-editor` instance. If provided, `mem-fs-editor` api is used instead of `fs` of node
 * @returns boolean
 */
export async function tryAddPropertiesTexts(
    env: CdsEnvironment,
    path: string,
    newI18nEntries: NewI18nEntry[],
    fs?: Editor
): Promise<boolean> {
    const i18nFilePath = capPropertiesPath(path, env);
    if (!(await doesExist(i18nFilePath))) {
        return false;
    }
    return writeToExistingI18nPropertiesFile(i18nFilePath, newI18nEntries, [], fs);
}
