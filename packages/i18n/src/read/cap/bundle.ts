import type { CdsEnvironment, I18nBundle } from '../../types';
import {
    getCapI18nFiles,
    getI18nConfiguration,
    jsonPath,
    capPropertiesPath,
    csvPath,
    doesExist,
    readFile,
    nodeFsBackend
} from '../../utils';
import type { StorageBackend } from '../../utils';
import { jsonToI18nBundle } from '../../transformer/json';
import { propertiesToI18nEntry } from '../../transformer/properties';
import { csvToI18nBundle } from '../../transformer/csv';

/**
 * A read-side transformer: maps a resolved file path to an I18nBundle.
 */
export interface BundleTransformer {
    toI18nBundle: (content: string, path?: string) => I18nBundle;
    bundlePath: (path: string, env: CdsEnvironment) => string;
}

/**
 * Try to convert text to i18n bundle.
 *
 * @param path file path
 * @param toI18nBundle function to convert to i18n bundle
 * @param backend storage backend to use. Defaults to Node.js `fs/promises`.
 * @returns i18n bundle or undefined
 */
async function tryTransformTexts(
    path: string,
    toI18nBundle: (content: string, path?: string) => I18nBundle,
    backend: StorageBackend = nodeFsBackend
): Promise<I18nBundle | undefined> {
    if (!(await doesExist(path, backend))) {
        return undefined;
    }
    const content = await readFile(path, backend);
    return toI18nBundle(content, path);
}

/**
 * Build the default transformer list for a given fallback language.
 *
 * @param fallbackLanguage fallback language key
 * @returns ordered array of BundleTransformer
 */
function defaultTransformers(fallbackLanguage: string): BundleTransformer[] {
    return [
        { toI18nBundle: jsonToI18nBundle, bundlePath: jsonPath },
        {
            toI18nBundle: (content: string, path?: string): I18nBundle => ({
                [fallbackLanguage]: propertiesToI18nEntry(content, path)
            }),
            bundlePath: capPropertiesPath
        },
        { toI18nBundle: csvToI18nBundle, bundlePath: csvPath }
    ];
}

/**
 * Merges i18n files in to a single bundle for CDS source files.
 *
 * @param root project root
 * @param env CDS environment configuration
 * @param filePaths CDS file path
 * @param backend storage backend to use. Defaults to Node.js `fs/promises`.
 * @param transformers ordered list of read strategies; defaults to json, properties, csv
 * @returns i18n bundle or exception
 */
export async function getCapI18nBundle(
    root: string,
    env: CdsEnvironment,
    filePaths: string[],
    backend: StorageBackend = nodeFsBackend,
    transformers?: BundleTransformer[]
): Promise<I18nBundle> {
    const bundle: I18nBundle = {};
    const { defaultLanguage, fallbackLanguage } = getI18nConfiguration(env);
    const resolvedTransformers = transformers ?? defaultTransformers(fallbackLanguage);
    const i18nFileLocations = getCapI18nFiles(root, env, filePaths);
    for (const path of i18nFileLocations) {
        for (const { toI18nBundle, bundlePath } of resolvedTransformers) {
            const i18nFilePath = bundlePath(path, env);
            const entries = await tryTransformTexts(i18nFilePath, toI18nBundle, backend);
            if (!entries) {
                continue;
            }
            const currentBundle = entries[fallbackLanguage] ?? entries[defaultLanguage] ?? [];
            for (const entry of currentBundle) {
                if (!bundle[entry.key.value]) {
                    bundle[entry.key.value] = [];
                }
                bundle[entry.key.value].push(entry);
            }
            break;
        }
    }

    return bundle;
}
