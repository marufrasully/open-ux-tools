import { promises, stat } from 'node:fs';
import type { Editor } from 'mem-fs-editor';

/**
 * Abstraction over file-system I/O.
 * Two implementations are provided:
 *  - `nodeFsBackend`  — delegates to Node.js `fs/promises` (default)
 *  - `memFsBackend()` — delegates to a `mem-fs-editor` instance
 */
export interface StorageBackend {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdir(dir: string): Promise<void>;
}

/**
 * StorageBackend backed by Node.js `fs/promises`.
 */
export const nodeFsBackend: StorageBackend = {
    read: (path) => promises.readFile(path, { encoding: 'utf8' }),
    write: (path, content) => promises.writeFile(path, content, { encoding: 'utf8' }).then(() => undefined),
    exists: (path) =>
        new Promise((resolve) => {
            stat(path, (err) => resolve(!err));
        }),
    mkdir: (dir) => promises.mkdir(dir, { recursive: true }).then(() => undefined)
};

/**
 * Creates a StorageBackend backed by a `mem-fs-editor` instance.
 * `mkdir` is a no-op because mem-fs materialises directories on `commit()`.
 *
 * @param fs mem-fs-editor instance
 * @returns StorageBackend
 */
export function memFsBackend(fs: Editor): StorageBackend {
    return {
        read: (path) => Promise.resolve(fs.read(path)),
        write: (path, content) => {
            fs.write(path, content);
            return Promise.resolve();
        },
        exists: (path) => Promise.resolve(fs.exists(path)),
        mkdir: () => Promise.resolve()
    };
}
