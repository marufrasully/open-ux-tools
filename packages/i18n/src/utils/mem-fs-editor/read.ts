import { nodeFsBackend } from '../storage-backend';
import type { StorageBackend } from '../storage-backend';

/**
 * Read the entire contents of a file.
 *
 * @param filePath absolute path to a file.
 * @param backend storage backend to use. Defaults to Node.js `fs/promises`.
 * @returns file content
 */
export async function readFile(filePath: string, backend: StorageBackend = nodeFsBackend): Promise<string> {
    return backend.read(filePath);
}
