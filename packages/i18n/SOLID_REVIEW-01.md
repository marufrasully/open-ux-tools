# `@sap-ux/i18n` — Design Review

**Scope:** `packages/i18n/src/` (47 source files)
**Skills used:** `solid-srp`, `solid-ocp`, `solid-lsp`, `solid-isp`, `solid-dip`, `dp-scan`, `boo-scan`

---

## Executive Summary

The package is a well-layered utility library. The top-level split into `parser/`, `transformer/`, `read/`, `write/`, and `utils/` is sound. Functional patterns (pure functions, recursion, async/await) are used consistently. The Revealing Module pattern is applied correctly throughout.

The key weaknesses fall into three clusters:

1. **Enum usage** — `SapShortTextType`, `SapLongTextType`, `FileFormat`, `TokenType` are TypeScript enums in violation of the project's own AGENTS.md guideline ("Avoid TypeScript enums").
2. **Hardcoded format dispatch** — the read/write layers independently hardcode the same JSON → `.properties` → CSV priority chain with no shared extension point.
3. **I/O abstraction gap** — infrastructure (`node:fs`, `mem-fs-editor`, `vscode-languageserver-textdocument`) is referenced concretely throughout business-logic functions, preventing testing without real file-system dependencies.

---

## Table of Contents

- [SOLID Principles](#solid-principles)
  - [S — Single Responsibility](#s--single-responsibility-principle)
  - [O — Open/Closed](#o--openclosed-principle)
  - [L — Liskov Substitution](#l--liskov-substitution-principle)
  - [I — Interface Segregation](#i--interface-segregation-principle)
  - [D — Dependency Inversion](#d--dependency-inversion-principle)
- [GoF Design Patterns](#gof-design-patterns)
  - [Present Patterns](#present-patterns)
  - [Violations and Missed Opportunities](#violations-and-missed-opportunities)
- [Beyond-OO Patterns](#beyond-oo-patterns)
  - [Present Patterns](#present-beyond-oo-patterns)
  - [Smells and Opportunities](#smells-and-opportunities)

---

## SOLID Principles

### S — Single Responsibility Principle

**9 violations found.**

#### SRP-1 — `tryAddCsvTexts`: mixed I/O + computation

**File:** [src/write/cap/csv.ts:114-129](src/write/cap/csv.ts#L114-L129)

```typescript
export async function tryAddCsvTexts(...): Promise<boolean> {
    const i18nFilePath = csvPath(path);
    if (!(await doesExist(i18nFilePath))) { return false; }  // I/O: existence check
    const content = await readFile(i18nFilePath, fs);         // I/O: read
    const newContent = addCsvTexts(content, ...);             // computation: transform
    await writeFile(i18nFilePath, newContent, fs);            // I/O: write
    return true;
}
```

**Reason:** The function has three independent reasons to change: (1) the persistence strategy (existence check, read, write), (2) the CSV merging algorithm (`addCsvTexts`), and (3) the orchestration of the two. The same violation is identically repeated in the companion functions below.

---

#### SRP-2 — `tryAddJsonTexts`: mixed I/O + computation

**File:** [src/write/cap/json.ts:155-170](src/write/cap/json.ts#L155-L170)

Same structure as SRP-1. Fuses file-existence check, read, JSON transform, and write in one function.

---

#### SRP-3 — `tryAddPropertiesTexts`: mixed I/O + computation + fallback orchestration

**File:** [src/write/cap/properties.ts:18-42](src/write/cap/properties.ts#L18-L42)

**Reason:** Beyond the I/O + computation fusion of SRP-1/2, this function also formats new entries before knowing whether the target file exists (a premature computation), and contains fallback strategy logic (`if (!completed) tryAddCsvTexts(...)`) that belongs at the orchestration layer (`createCapI18nEntries`).

---

#### SRP-4 — `writeToExistingI18nPropertiesFile`: four responsibilities in one function

**File:** [src/write/utils/index.ts:18-42](src/write/utils/index.ts#L18-L42)

**Reason:** (1) formats new entries via `printPropertiesI18nEntry`, (2) reads the existing file, (3) removes keys via `removeKeysFromI18nPropertiesFile`, and (4) applies a layout/whitespace rule (prepend `\n` if last line is non-empty). Four independent reasons to change.

---

#### SRP-5 — `getCapI18nFolder`: path resolution + directory creation side-effect

**File:** [src/utils/resolve.ts:107-119](src/utils/resolve.ts#L107-L119)

```typescript
export async function getCapI18nFolder(...): Promise<string> {
    let i18nFolderPath = resolveCapI18nFolderForFile(root, env, path); // query
    if (!i18nFolderPath) {
        await promises.mkdir(i18nFolderPath);  // side effect: creates directory
    }
    return i18nFolderPath;
}
```

**Reason:** Resolving "where is the i18n folder?" and "create it if missing" are separate concerns. The creation decision belongs to the caller (`createCapI18nEntries`).

---

#### SRP-6 — `printPropertiesI18nAnnotation`: derives metadata + serialises

**File:** [src/utils/print.ts:12-38](src/utils/print.ts#L12-L38)

**Reason:** Both computes annotation metadata (applying the `<= 120` length rule to derive `textType` and `prefix`) and serialises it to a `.properties` string. Two reasons to change: business threshold rules and serialisation format.

---

#### SRP-7 — `utils/text.ts`: kitchen-sink module with three unrelated concerns

**File:** [src/utils/text.ts:1-150](src/utils/text.ts#L1-L150)

| Lines | Functions | Concern |
|-------|-----------|---------|
| [11–34](src/utils/text.ts#L11-L34) | `getI18nMaxLength`, `getI18nTextType` | SAP annotation business rules |
| [42–99](src/utils/text.ts#L42-L99) | `discoverLineEnding`, `discoverIndent`, `applyIndent` | Text/whitespace formatting |
| [108–150](src/utils/text.ts#L108-L150) | `convertToCamelCase`, `convertToPascalCase` | Generic string case conversion |

**Reason:** Three independent concerns in one module.

---

#### SRP-8 — `PropertiesTokenizer`: token recognition + scan orchestration in one class

**File:** [src/parser/properties/lexer/index.ts:104-386](src/parser/properties/lexer/index.ts#L104-L386)

**Reason:** Individual `consume*` methods handle token recognition for specific patterns; `tokenize()` handles the dispatch loop. Changes to orchestration order are interleaved with changes to individual token patterns. Symptom: the duplicate `isEscape` / `isEscapeS` functions at [lines 22–23](src/parser/properties/lexer/index.ts#L22-L23) and [72–74](src/parser/properties/lexer/index.ts#L72-L74) — identical implementations, used in different parts of the same class.

---

#### SRP-9 — Duplicated business rule: the `120`-character threshold

**Files:** [src/utils/print.ts:20](src/utils/print.ts#L20), [src/utils/text.ts:29-34](src/utils/text.ts#L29-L34)

**Reason:** The SAP short/long text boundary (`<= 120`) is encoded in two separate places. `printPropertiesI18nAnnotation` replicates the threshold inline for the raw-string annotation path instead of delegating to `getI18nTextType`. A change to the threshold requires editing both files.

---

### O — Open/Closed Principle

**6 violations found.**

#### OCP-1 — `parse()`: if/else dispatch on `FileFormat` enum

**File:** [src/parser/index.ts:13-18](src/parser/index.ts#L13-L18)

```typescript
export function parse(text: string, format: FileFormat): ParseResult {
    if (format === FileFormat.properties) return parseProperties(text);
    return parseCsv(text);  // FileFormat.json falls through silently to parseCsv
}
```

**Reason:** Adding a new format requires editing this function. `FileFormat` already declares `json` ([src/parser/types.ts:7](src/parser/types.ts#L7)), but `parse()` never handles it — a silent correctness gap. A strategy map `Record<FileFormat, Parser>` would close this function for modification.

---

#### OCP-2 — `createCapI18nEntries`: hardcoded updater list

**File:** [src/write/cap/create.ts:36-44](src/write/cap/create.ts#L36-L44)

```typescript
const updaters = [tryAddJsonTexts, tryAddPropertiesTexts, tryAddCsvTexts];
for (const update of updaters) { ... }
```

**Reason:** The ordered list of write strategies is hardcoded inside the function. Adding a new write format (e.g. YAML) requires editing `create.ts`. The list should be an injectable parameter with the current trio as the default.

---

#### OCP-3 — `getCapI18nBundle`: hardcoded transformer array

**File:** [src/read/cap/bundle.ts:42-51](src/read/cap/bundle.ts#L42-L51)

```typescript
const getTransformers = (fallbackLanguage: string) => [
    { toI18nBundle: jsonToI18nBundle, bundlePath: jsonPath },
    { toI18nBundle: ..., bundlePath: capPropertiesPath },
    { toI18nBundle: csvToI18nBundle, bundlePath: csvPath }
];
```

**Reason:** The read-side mirror of OCP-2. Supporting a new readable format requires modifying `bundle.ts`. Define a `BundleTransformer` interface and accept the transformer list as an injectable parameter.

---

#### OCP-4 — `printPropertiesI18nAnnotation`: `typeof`-based annotation type-switch

**File:** [src/utils/print.ts:12-38](src/utils/print.ts#L12-L38)

**Reason:** Three branches selected by runtime type inspection. A new annotation shape requires adding a new branch. A formatter-strategy array (each element implementing `matches(a): boolean` + `format(text, a): string`) would allow adding new annotation types without modifying this function.

---

#### OCP-5 — `getI18nUniqueKey`: `Array.isArray` dual-path on container type

**File:** [src/utils/key.ts:57-62](src/utils/key.ts#L57-L62)

**Reason:** A third container type (e.g. `Map<string, I18nEntry[]>`) requires a new branch. Accepting a `keyExists: (k: string) => boolean` predicate instead would close the function.

---

#### OCP-6 — `if (fs)` I/O adapter branch repeated across all read/write call sites

**Files:** [src/utils/mem-fs-editor/read.ts:12-15](src/utils/mem-fs-editor/read.ts#L12-L15), [src/utils/mem-fs-editor/write.ts:12-16](src/utils/mem-fs-editor/write.ts#L12-L16), [src/write/properties/create.ts:24](src/write/properties/create.ts#L24) and [48](src/write/properties/create.ts#L48)

**Reason:** The `if (fs) { use mem-fs } else { use node:fs }` pattern is duplicated at every I/O call site. Adding a third I/O backend (e.g. `vscode.workspace.fs`) requires editing every call site. An `IFileSystem` interface with two concrete adapters (`NodeFsAdapter`, `MemFsAdapter`) would resolve this.

---

### L — Liskov Substitution Principle

**3 violations found.**

#### LSP-1 — `getI18nUniqueKey`: `I18nEntry[] | I18nBundle` requires runtime type check

**File:** [src/utils/key.ts:49-70](src/utils/key.ts#L49-L70)

```typescript
export function getI18nUniqueKey(key: string, i18nData: I18nEntry[] | I18nBundle, ...): string {
    if (Array.isArray(i18nData)) {          // must type-check to use the parameter
        keyExists = i18nData.findIndex(...) !== -1;
    } else {
        keyExists = i18nData[key] !== undefined;
    }
}
```

**Reason:** `I18nEntry[]` and `I18nBundle` cannot be substituted for each other; the function cannot operate on either without a `Array.isArray` discriminator. A shared `interface KeyedI18nLookup { hasKey(key: string): boolean }` would make both types substitutable.

---

#### LSP-2 — `printPropertiesI18nAnnotation`: `typeof` guards + weakened postcondition

**File:** [src/utils/print.ts:12-38](src/utils/print.ts#L12-L38)

**Reason:** Requires `typeof annotation === 'string'` and `typeof annotation === 'object'` guards to dispatch. The two branches also produce outputs under different postconditions (the `string` branch prepends `X`/`Y` from `text.length`; the `object` branch uses `annotation.textType` directly). The `return ''` fallthrough at [line 38](src/utils/print.ts#L38) is dead code that weakens the postcondition silently.

---

#### LSP-3 — `parse()` weakens postcondition for `FileFormat.json`

**File:** [src/parser/index.ts:13-18](src/parser/index.ts#L13-L18)

**Reason:** `FileFormat` has three members (`properties`, `csv`, `json`). Calling `parse(text, FileFormat.json)` silently falls through to `parseCsv`, returning a `CsvParseResult` for JSON input — a behavioral contract violation. Either handle `json` explicitly or remove it from the enum.

---

### I — Interface Segregation Principle

**4 violations found.**

#### ISP-1 — `NewI18nEntry.annotation: I18nAnnotation | string` — fat union field

**File:** [src/types.ts:43-50](src/types.ts#L43-L50)

**Reason:** Every consumer of `NewI18nEntry` must handle both `I18nAnnotation` (structured metadata) and `string` (raw pre-formatted annotation) even if they only ever use one shape. These serve different clients and should be modeled as separate optional-extension interfaces.

---

#### ISP-2 — `getI18nUniqueKey(i18nData: I18nEntry[] | I18nBundle)` — fat union parameter

**File:** [src/utils/key.ts:49-51](src/utils/key.ts#L49-L51)

**Reason:** Every call site must acknowledge both array-based and map-based i18n data structures. The `Array.isArray` guard is the ISP "canDoX" smell applied at the function-argument level. Two narrow overloads (`getI18nUniqueKeyFromList` / `getI18nUniqueKeyFromBundle`) would each serve one client.

---

#### ISP-3 — `src/index.ts` barrel exposes internal utilities as public API

**File:** [src/index.ts:4-15](src/index.ts#L4-L15)

```typescript
export {
    getI18nMaxLength, getI18nTextType,       // internal annotation helpers
    convertToCamelCase, convertToPascalCase, // generic string utilities
    extractDoubleCurlyBracketsKey,           // narrow Angular-template helper
    printPropertiesI18nEntry, ...
} from './utils';
```

**Reason:** Consumers who only use `getCapI18nBundle` are forced to depend on `.properties` serialisation helpers, string case utilities, and Angular-specific key extraction. Sub-path exports (`package.json` `exports` field) would let callers opt into only what they need.

---

#### ISP-4 — `src/utils/index.ts` barrel aggregates nine unrelated concerns

**File:** [src/utils/index.ts:1-15](src/utils/index.ts#L1-L15)

**Reason:** CDS config reading, filesystem resolution, path helpers, file-existence check, `.properties` serialisation, text metrics, line-ending detection, case conversion, and mem-fs I/O are all re-exported from a single flat surface. A consumer needing only `readFile`/`writeFile` is forced to depend on all of this.

---

### D — Dependency Inversion Principle

**4 violation categories found (13 individual violations).**

#### DIP-1 — Hardcoded `node:fs` fallback in I/O adapters called from business logic

**Files:**
- [src/utils/mem-fs-editor/read.ts:1](src/utils/mem-fs-editor/read.ts#L1) and [15](src/utils/mem-fs-editor/read.ts#L15)
- [src/utils/mem-fs-editor/write.ts:1](src/utils/mem-fs-editor/write.ts#L1) and [16](src/utils/mem-fs-editor/write.ts#L16)
- [src/utils/path.ts:43-52](src/utils/path.ts#L43-L52) (`doesExist` uses callback-style `stat`)
- [src/utils/resolve.ts:55](src/utils/resolve.ts#L55) (`existsSync` inside domain traversal logic)
- [src/utils/resolve.ts:115](src/utils/resolve.ts#L115) (`promises.mkdir` inside path-resolver function)

**Reason:** Every high-level function that calls `readFile`, `writeFile`, or `doesExist` depends on concrete `node:fs` being available in the fallback path. An `IFileSystem { read, write, exists, mkdir }` interface with two adapter implementations (`NodeFsAdapter`, `MemFsAdapter`) should be injected at the composition root instead of defaulted internally.

---

#### DIP-2 — Concrete class instantiation without interface in parsers

**Files:**
- [src/parser/properties/lexer/index.ts:383-385](src/parser/properties/lexer/index.ts#L383-L385) (`new PropertiesTokenizer(text)`)
- [src/parser/properties/parser/properties-parser.ts:191-194](src/parser/properties/parser/properties-parser.ts#L191-L194) (`new PropertiesList(tokens, text)`)
- [src/parser/csv/parser/csv-parser.ts:158-164](src/parser/csv/parser/csv-parser.ts#L158-L164) (`new ParseCsv(text)`)

**Reason:** All three factory functions (`tokenize`, `getPropertyList`, `parseCsv`) instantiate a concrete class internally. Callers have no way to substitute an alternative implementation (different tokenizer strategy, mock parser in tests). There is no interface that any of these classes is bound by.

---

#### DIP-3 — TypeScript `enum` types used as domain types (project guideline violation)

**Files:** [src/types.ts:74-132](src/types.ts#L74-L132), [src/parser/types.ts:4-8](src/parser/types.ts#L4-L8), [src/parser/csv/types.ts:2-7](src/parser/csv/types.ts#L2-L7)

```typescript
export enum SapShortTextType { Label = 'XFLD', ... }   // generates a runtime object
export enum SapLongTextType  { MessageText = 'YMSG', ... }
export enum FileFormat { properties = 'properties', csv = 'csv', json = 'json' }
```

**Reason:** TypeScript enums generate concrete runtime objects. AGENTS.md explicitly states: *"Avoid TypeScript enums — prefer union types or const objects for better type safety and tree-shaking."* Using `as const` object literals with derived union types would make these purely compile-time constructs and close the extension gap.

---

#### DIP-4 — `TextDocument` static factory calls inside business write functions

**Files:**
- [src/write/utils/index.ts:52](src/write/utils/index.ts#L52) and [65](src/write/utils/index.ts#L65)
- [src/write/cap/json.ts:42](src/write/cap/json.ts#L42), [66](src/write/cap/json.ts#L66), [81](src/write/cap/json.ts#L81), [129](src/write/cap/json.ts#L129)
- [src/write/cap/csv.ts:74](src/write/cap/csv.ts#L74) and [102](src/write/cap/csv.ts#L102)

```typescript
const document = TextDocument.create('', '', 0, content);   // concrete external library call
return TextDocument.applyEdits(document, edits);
```

**Reason:** `TextDocument` from `vscode-languageserver-textdocument` is called as a static factory directly inside business-logic write functions. These functions cannot be tested without the real library and cannot be adapted if the text-edit API changes. An `ITextEditor { create, applyEdits, positionAt }` interface injected at the composition root would invert this dependency.

---

## GoF Design Patterns

### Present Patterns

| Pattern | Category | File(s) | Notes |
|---------|----------|---------|-------|
| **Factory Method** | Creational | [src/parser/index.ts:13-18](src/parser/index.ts#L13-L18) | `parse(text, format)` dispatches to `parseProperties` or `parseCsv` behind the `ParseResult` return type |
| **Builder** (partial) | Creational | [src/parser/properties/lexer/index.ts](src/parser/properties/lexer/index.ts), [src/parser/properties/parser/properties-parser.ts](src/parser/properties/parser/properties-parser.ts), [src/parser/csv/parser/csv-parser.ts](src/parser/csv/parser/csv-parser.ts), [src/parser/csv/lexer/index.ts](src/parser/csv/lexer/index.ts) | All four tokenizer/parser classes accumulate state in steps (`consume*()`/`create*()`) with a terminal retrieve method (`getTokens()`, `getList()`). Pattern intent is clear, but `return this` chaining is absent. |
| **Adapter** | Structural | [src/utils/mem-fs-editor/read.ts](src/utils/mem-fs-editor/read.ts), [src/utils/mem-fs-editor/write.ts](src/utils/mem-fs-editor/write.ts) | Adapts `node:fs/promises` and `mem-fs-editor` behind a uniform async function signature |
| **Strategy** | Behavioral | [src/read/cap/bundle.ts:42-51](src/read/cap/bundle.ts#L42-L51), [src/write/cap/create.ts:36-43](src/write/cap/create.ts#L36-L43) | Transformer/updater arrays where each element is an interchangeable algorithm with the same signature |
| **Chain of Responsibility** | Behavioral | [src/write/cap/create.ts:36-43](src/write/cap/create.ts#L36-L43), [src/read/cap/bundle.ts:72-87](src/read/cap/bundle.ts#L72-L87) | `for...of` loop over handlers; each tries the request and the chain stops on first success |
| **Interpreter** | Behavioral | [src/parser/properties/](src/parser/properties/) (lexer + parser), [src/parser/csv/](src/parser/csv/) (lexer + parser) | Two full lex + parse pipelines implementing formal grammars for `.properties` and CSV formats |

### Violations and Missed Opportunities

#### DP-V1 — TypeScript `enum` used as domain type (3 occurrences)

**Files:** [src/types.ts:74-132](src/types.ts#L74-L132), [src/parser/types.ts:4-8](src/parser/types.ts#L4-L8), [src/parser/csv/types.ts:2-7](src/parser/csv/types.ts#L2-L7)

**Reason:** Violates AGENTS.md. Enums generate runtime objects and harden the type against extension. Convert to `as const` + derived union types.

---

#### DP-V2 — `FileFormat.json` declared but `parse()` has no JSON case

**File:** [src/parser/index.ts:13-18](src/parser/index.ts#L13-L18)

**Reason:** The Factory Method silently falls through to `parseCsv` for `FileFormat.json` input. Either implement `parseJson` or remove `json` from the enum.

---

#### DP-V3 — Duplicated JSON→properties→CSV priority chain (read + write)

**Files:** [src/read/cap/bundle.ts:42-51](src/read/cap/bundle.ts#L42-L51), [src/write/cap/create.ts:36-43](src/write/cap/create.ts#L36-L43)

**Reason:** The "try JSON, then `.properties`, then CSV" priority order is encoded independently in both the read and write layers. A unified `FormatHandlerChain` configuration would make the priority a single source of truth.

---

#### DP-V4 — Missing Template Method for parallel lexer/parser classes

**Files:** [src/parser/properties/lexer/index.ts](src/parser/properties/lexer/index.ts), [src/parser/csv/lexer/index.ts](src/parser/csv/lexer/index.ts), [src/parser/properties/parser/properties-parser.ts](src/parser/properties/parser/properties-parser.ts), [src/parser/csv/parser/csv-parser.ts](src/parser/csv/parser/csv-parser.ts)

**Reason:** `PropertiesTokenizer` and `CsvTokenizer` share the same structural skeleton (offset cursor, `peek()`, `next()`, `createToken()`, `getTokens()`). `PropertiesList` and `ParseCsv` share the same cursor-mechanics structure. A `BaseTokenizer<TToken>` and `BaseParser<TToken, TResult>` abstract class would house the common steps as Template Method, leaving format-specific steps (`consume*()`) as overridable hooks.

---

#### DP-V5 — `CsvTokenizer.mode` string flag instead of State pattern

**File:** [src/parser/csv/lexer/index.ts:22](src/parser/csv/lexer/index.ts#L22) and [41-54](src/parser/csv/lexer/index.ts#L41-L54)

**Reason:** `private mode: 'default' | 'quoted'` drives branching in `createToken()`. Adding new modes (multi-line quoted, comment) will require cascading `if/else` edits. A proper State pattern with one object per mode would localise each mode's behaviour.

---

#### DP-V6 — `typeof node.value` switch without exhaustiveness check

**File:** [src/transformer/json/json.ts:33-68](src/transformer/json/json.ts#L33-L68)

**Reason:** `switch (typeof node.value)` with `case 'string'` / `'number'` / `'boolean'` / `default` lacks exhaustiveness checking. A discriminated union on `node.value` would allow TypeScript to enforce completeness.

---

#### DP-V7 — Telescoping optional parameters (Builder opportunity)

**File:** [src/write/properties/create.ts:18](src/write/properties/create.ts#L18) and [41](src/write/properties/create.ts#L41)

**Reason:** `createPropertiesI18nEntries(filePath, entries, root?, fs?)` and `removeAndCreateI18nEntries(filePath, entries, keysToRemove?, root?, fs?)` have up to five parameters with multiple optional trailing arguments. An options-object interface would improve call-site clarity.

---

## Beyond-OO Patterns

### Present Beyond-OO Patterns

| Pattern | Category | File(s) | Notes |
|---------|----------|---------|-------|
| **Pure Functions** | Functional | [src/utils/text.ts](src/utils/text.ts), [src/utils/key.ts](src/utils/key.ts), [src/utils/config.ts](src/utils/config.ts), [src/utils/print.ts](src/utils/print.ts), all `src/transformer/**` | Transformer and utility modules are entirely pure: deterministic output, no side effects, no mutation of external state |
| **Recursion** | Functional | [src/utils/key.ts:49-70](src/utils/key.ts#L49-L70), [src/utils/resolve.ts:51-71](src/utils/resolve.ts#L51-L71) | `getI18nUniqueKey` is tail-recursive; `resolveCapI18nFolderForFile` recurses up the directory tree |
| **Promises** | Functional | All `src/write/**`, `src/read/**`, [src/utils/path.ts](src/utils/path.ts) | Consistent `async/await` throughout |
| **Functor** (partial) | Functional | [src/transformer/csv/csv.ts:11-19](src/transformer/csv/csv.ts#L11-L19), [src/transformer/json/json.ts:13-68](src/transformer/json/json.ts#L13-L68) | `toTextNode()` maps raw AST nodes into `TextNode<T>` structure-preserving transforms |
| **Currying** (partial) | Functional | [src/read/cap/bundle.ts:42-51](src/read/cap/bundle.ts#L42-L51) | `getTransformers(fallbackLanguage)` closes over `fallbackLanguage` to produce partially-applied transform functions |
| **Revealing Module** | Infrastructure | [src/index.ts](src/index.ts), all sub-`index.ts` files | Every subdirectory re-exports only intentionally public symbols; private helpers remain unexported |
| **DAO** (partial) | Infrastructure | [src/utils/mem-fs-editor/read.ts](src/utils/mem-fs-editor/read.ts), [src/utils/mem-fs-editor/write.ts](src/utils/mem-fs-editor/write.ts) | `readFile`/`writeFile` abstract two storage backends behind a uniform interface |
| **External Config Store** | Infrastructure | [src/utils/config.ts](src/utils/config.ts), [src/types.ts:141-163](src/types.ts#L141-L163) | `CdsEnvironment`/`CdsI18nEnv` model an externally supplied configuration store; `getI18nConfiguration()` reads it with safe defaults |
| **Pipes and Filters** | Architecture | [src/read/cap/bundle.ts:42-91](src/read/cap/bundle.ts#L42-L91), [src/write/cap/create.ts:36-43](src/write/cap/create.ts#L36-L43) | Sequential filter pipelines where each stage transforms data and passes it to the next |
| **Service Layer** (partial) | Architecture | [src/read/cap/bundle.ts](src/read/cap/bundle.ts), [src/write/cap/create.ts](src/write/cap/create.ts), [src/write/properties/create.ts](src/write/properties/create.ts) | `getCapI18nBundle`, `createCapI18nEntries`, `createPropertiesI18nEntries` form a thin service layer over parsing/writing infrastructure |

### Smells and Opportunities

#### BOO-S1 — Missing formal `IFileSystem` port (Hexagonal Architecture opportunity)

**Files:** [src/utils/mem-fs-editor/read.ts:11](src/utils/mem-fs-editor/read.ts#L11), [src/utils/mem-fs-editor/write.ts:12](src/utils/mem-fs-editor/write.ts#L12)

**Reason:** The DAO pattern exists informally (two backends behind `readFile`/`writeFile`), but is expressed as an `if (fs)` branch rather than a proper Port interface. Formalizing `IFileSystem { read, write, exists, mkdir }` with two Adapter implementations (`NodeFsAdapter`, `MemFsAdapter`) would complete a Hexagonal Architecture. This is the single change with the highest test-isolation payoff.

---

#### BOO-S2 — Missing Memoization on repeated `existsSync` / folder resolution calls

**Files:** [src/utils/resolve.ts:55](src/utils/resolve.ts#L55), [src/read/cap/bundle.ts:74-76](src/read/cap/bundle.ts#L74-L76)

**Reason:** `resolveCapI18nFolderForFile` calls `existsSync` in a recursive directory-traversal loop. When many CDS files share the same i18n folder (the common case), the same folder existence checks are repeated. A `Map`-based memo on folder resolution would eliminate redundant `existsSync` calls.

---

#### BOO-S3 — Transformer selection is hardcoded (Service Provider opportunity)

**Files:** [src/read/cap/bundle.ts:42-51](src/read/cap/bundle.ts#L42-L51), [src/write/cap/create.ts:36-43](src/write/cap/create.ts#L36-L43)

**Reason:** `getTransformers()` and `updaters` are hardcoded arrays. A `Map<FileFormat, Transformer>` registry (Service Provider pattern) would make the system open for extension without modification.

---

#### BOO-S4 — `doesExist` uses callback-style `stat` instead of `promises.stat`

**File:** [src/utils/path.ts:43-53](src/utils/path.ts#L43-L53)

```typescript
export function doesExist(path: string): Promise<boolean> {
    return new Promise((resolve) => {
        stat(path, (err) => { ... });  // manual Promise wrapping
    });
}
```

**Reason:** `fs.promises.stat` is already imported elsewhere in the codebase. The manual callback wrapping is unnecessary and inconsistent with the rest of the async code style.

---

#### BOO-S5 — `isEscape` / `isEscapeS` duplicate functions

**File:** [src/parser/properties/lexer/index.ts:22-23](src/parser/properties/lexer/index.ts#L22-L23) and [72-74](src/parser/properties/lexer/index.ts#L72-L74)

**Reason:** Two functions with nearly identical names and identical implementations (`character === '\\'`). One is dead code. The distinction between the two is unclear and should be resolved.

---

#### BOO-S6 — Magic number `120` used without a named constant

**Files:** [src/utils/text.ts:29-33](src/utils/text.ts#L29-L33), [src/utils/print.ts:20](src/utils/print.ts#L20)

**Reason:** The SAP short-text length boundary (`120`) appears in two modules without a shared named constant. Should be extracted to `src/types.ts` or a `src/constants.ts` as `SAP_SHORT_TEXT_MAX_LENGTH = 120`.

---

#### BOO-S7 — Sequential `for...of` over file paths prevents parallelism

**File:** [src/read/cap/bundle.ts:71-88](src/read/cap/bundle.ts#L71-L88)

**Reason:** The outer `for (const path of i18nFileLocations)` loop with inner sequential transformer attempts blocks parallelism. File-path-level processing via `Promise.all(i18nFileLocations.map(...))` would improve throughput when multiple CDS files are involved.

---

## Summary: Priority Matrix

| Priority | ID | Category | File | Issue |
|----------|----|----------|------|-------|
| 🔴 High | DIP-3 | DIP + dp-scan | [src/types.ts:74-132](src/types.ts#L74-L132), [src/parser/types.ts:4-8](src/parser/types.ts#L4-L8), [src/parser/csv/types.ts:2-7](src/parser/csv/types.ts#L2-L7) | TypeScript `enum` usage violates AGENTS.md and closes extension points |
| 🔴 High | DIP-1 / OCP-6 | DIP + OCP | [src/utils/mem-fs-editor/read.ts](src/utils/mem-fs-editor/read.ts), [src/utils/path.ts](src/utils/path.ts), [src/utils/resolve.ts](src/utils/resolve.ts) | Hardcoded `node:fs` throughout; define `IFileSystem` port |
| 🟠 Medium | OCP-1 / LSP-3 | OCP + LSP | [src/parser/index.ts:13-18](src/parser/index.ts#L13-L18) | `FileFormat.json` declared but not handled → silent wrong-parser dispatch |
| 🟠 Medium | OCP-2 / OCP-3 | OCP | [src/write/cap/create.ts:36-44](src/write/cap/create.ts#L36-L44), [src/read/cap/bundle.ts:42-51](src/read/cap/bundle.ts#L42-L51) | Hardcoded format arrays in read + write; make injectable |
| 🟠 Medium | DIP-4 | DIP | [src/write/cap/json.ts:42](src/write/cap/json.ts#L42), [src/write/cap/csv.ts:74](src/write/cap/csv.ts#L74), [src/write/utils/index.ts:52](src/write/utils/index.ts#L52) | `TextDocument` static factory calls inside business logic |
| 🟡 Low | DP-V4 | dp-scan | [src/parser/properties/lexer/index.ts](src/parser/properties/lexer/index.ts), [src/parser/csv/lexer/index.ts](src/parser/csv/lexer/index.ts) | Missing Template Method base class for parallel tokenizer/parser structures |
| 🟡 Low | SRP-7 | SRP | [src/utils/text.ts:1-150](src/utils/text.ts#L1-L150) | Three unrelated concerns in one module |
| 🟡 Low | ISP-3 / ISP-4 | ISP | [src/index.ts:4-15](src/index.ts#L4-L15), [src/utils/index.ts:1-15](src/utils/index.ts#L1-L15) | Barrel over-exposure of internal utilities |
| 🟡 Low | BOO-S2 | boo-scan | [src/utils/resolve.ts:55](src/utils/resolve.ts#L55) | Missing memoization on repeated `existsSync` calls |
| 🟡 Low | BOO-S4 | boo-scan | [src/utils/path.ts:43-53](src/utils/path.ts#L43-L53) | `doesExist` uses obsolete callback-style `stat` |
