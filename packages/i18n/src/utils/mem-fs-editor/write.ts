import { nodeFsBackend } from '../storage-backend';
import type { StorageBackend } from '../storage-backend';

/**
 * Write data to a file.
 *
 * @param filePath absolute path to a file
 * @param content content to write
 * @param backend storage backend to use. Defaults to Node.js `fs/promises`.
 */
export async function writeFile(
    filePath: string,
    content: string,
    backend: StorageBackend = nodeFsBackend
): Promise<void> {
    return backend.write(filePath, content);
}
