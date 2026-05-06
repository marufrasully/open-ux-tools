const INDENT_PATTERN = /(?:\r|\n|\r?\n)([ \t]+)/;
const LINE_ENDING_PATTERN = /\r|\n|\r?\n/;

/**
 * Discover line ending.
 *
 * @param text text
 * @returns text
 */
export function discoverLineEnding(text: string): string {
    for (let i = 0; i < text.length; i++) {
        const character = text[i];
        if (character === '\r') {
            if (i + 1 < text.length && text[i + 1] === '\n') {
                return '\r\n';
            }
            return '\r';
        } else if (character === '\n') {
            return '\n';
        }
    }

    return '\n';
}

/**
 * Discover indent.
 *
 * @param text text
 * @returns indented text
 */
export function discoverIndent(text: string): string {
    const match = INDENT_PATTERN.exec(text);
    if (match) {
        return match[1];
    }

    return '    ';
}

/**
 * Apply indent.
 *
 * @param text text
 * @param indent indent
 * @param eol end of line
 * @param indentFirstLine indent first line
 * @returns indented text
 */
export function applyIndent(text: string, indent: string, eol: string, indentFirstLine = true): string {
    const lines = text.split(LINE_ENDING_PATTERN);
    let out = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!indentFirstLine && i === 0) {
            out += line;
        } else {
            out += indent + line;
        }
        if (i + 1 !== lines.length) {
            out += eol;
        }
    }
    return out;
}
