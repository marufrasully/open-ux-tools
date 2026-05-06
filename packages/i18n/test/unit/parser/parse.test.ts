import { parse } from '../../../src/parser';
import { FileFormat } from '../../../src/parser/types';

describe('parse', () => {
    test('unsupported format throws', () => {
        expect(() => parse('text', FileFormat.json)).toThrow('Unsupported file format: json');
    });
});
