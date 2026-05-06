import { join, dirname, sep } from 'node:path';
import { existsSync } from 'node:fs';
import type { CdsEnvironment } from '../types';
import { getI18nConfiguration } from './config';

/**
 * Normalize file pth.
 *
 * @param path file path
 * @returns normalized file path
 */
function normalizePath(path: string): string {
    if (process.platform === 'win32') {
        return path.charAt(0).toLowerCase() + path.slice(1);
    }
    return path;
}

/**
 * Check if path a start with path b.
 *
 * @param a file path one
 * @param b file path two
 * @returns boolean
 */
function pathStartsWith(a: string, b: string): boolean {
    return normalizePath(a).startsWith(normalizePath(b));
}

const nodeModules = sep + 'node_modules';

/**
 * Returns the location of an existing `_i18n` folder next to or in the
 * folder hierarchy above the given path, if any.
 *
 * @param root project root
 * @param env CDS environment configuration
 * @param filePath CDS source file path
 * @returns i18n folder or undefined
 */
export function resolveCapI18nFolderForFile(root: string, env: CdsEnvironment, filePath: string): string | undefined {
    const { folders } = getI18nConfiguration(env);

    /**
     * Resolve file path.
     *
     * @param path file path
     * @returns file path or undefined
     */
    function resolve(path: string): string | undefined {
        // check whether a <path>/_i18n exists
        for (const folderName of folders) {
            const folderPath = join(path, folderName);
            if (existsSync(folderPath)) {
                return folderPath;
            }
        }
        //> no --> search up the folder hierarchy
        const next = dirname(path);

        if (next.includes(nodeModules)) {
            if (next.endsWith(nodeModules)) {
                return undefined;
            }
        } else if (!pathStartsWith(next, root)) {
            return undefined;
        }
        return !next || next === path ? undefined : resolve(next);
    }
    return resolve(filePath);
}

/**
 * Merges i18n files for CDS source files.
 *
 * @param root project root
 * @param env CDS environment configuration
 * @param filePaths CDS file path
 * @returns i18n files
 */
export function getCapI18nFiles(root: string, env: CdsEnvironment, filePaths: string[]): string[] {
    const { baseFileName } = getI18nConfiguration(env);
    const i18nFiles = filePaths.reduce((acc: string[], filePath) => {
        const i18nFolder = resolveCapI18nFolderForFile(root, env, filePath);
        if (i18nFolder) {
            const file = join(i18nFolder, baseFileName);
            if (acc.indexOf(file) === -1) {
                acc.push(file);
            }
        }
        return acc;
    }, []);

    return i18nFiles;
}

/**
 * Resolve the i18n folder path for a CDS file.
 * Returns the first existing folder found in the hierarchy, or the default
 * `<root>/<folders[0]>` path when none exists. Never creates directories.
 *
 * @param root project root
 * @param path absolute path to cds file
 * @param env CDS environment configuration
 * @returns resolved i18n folder path
 */
export function getCapI18nFolder(root: string, path: string, env: CdsEnvironment): string {
    const { folders } = getI18nConfiguration(env);
    return resolveCapI18nFolderForFile(root, env, path) ?? join(root, folders[0]);
}
