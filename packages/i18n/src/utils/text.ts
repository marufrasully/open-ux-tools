// backward-compat re-export barrel — individual concerns now live in focused modules
export { getI18nMaxLength, getI18nTextType, getAnnotationPrefix } from './annotation';
export { discoverLineEnding, discoverIndent, applyIndent } from './whitespace';
export { convertToCamelCase, convertToPascalCase } from './string-case';
