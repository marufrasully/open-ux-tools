import { create as createStorage } from 'mem-fs';
import { create } from 'mem-fs-editor';
import { writeFile, memFsBackend } from '../../../../src/utils';
import * as fs from 'node:fs';

describe('write', () => {
    describe('writeFile', () => {
        const filePath = 'absolute-path-to-a-file';
        const content = 'some-content';
        test('mem-fs-editor', async () => {
            const promiseWriteFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue();
            const memFs = create(createStorage());
            const writeSpy = jest.spyOn(memFs, 'write').mockReturnValue(content);

            await writeFile(filePath, content, memFsBackend(memFs));
            expect(writeSpy).toHaveBeenNthCalledWith(1, filePath, content);
            expect(promiseWriteFileSpy).toHaveBeenCalledTimes(0);
        });
        test('promises.writeFile', async () => {
            const promiseWriteFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue();

            await writeFile(filePath, content);
            expect(promiseWriteFileSpy).toHaveBeenNthCalledWith(1, filePath, content, { encoding: 'utf8' });
        });
    });
});
