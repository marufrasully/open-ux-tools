# Pattern Review: `packages/i18n`

**Date:** 2026-05-15
**Scope:** `packages/i18n/src` — all 49 source files
**Skills applied:** `solid-srp`, `solid-ocp`, `solid-dip`, `dp-scan`, `boo-scan`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [SOLID Principles](#solid-principles)
   - [SRP — Single Responsibility](#srp--single-responsibility-principle)
   - [OCP — Open/Closed](#ocp--openclosed-principle)
   - [DIP — Dependency Inversion](#dip--dependency-inversion-principle)
3. [GoF Design Patterns](#gof-design-patterns)
   - [Patterns Present](#patterns-present)
   - [Patterns Absent — Opportunities](#patterns-absent--opportunities)
4. [Beyond-OO Patterns](#beyond-oo-patterns)
   - [Patterns Present](#beyond-oo-patterns-present)
   - [Code Smells](#beyond-oo-code-smells)
5. [Priority Summary](#priority-summary)

---

## Executive Summary

`packages/i18n` is a well-structured i18n infrastructure library. It supports three file formats
(`.properties`, `.json`, `.csv`), full LSP range tracking, and the CAP/CDS environment. A series
of recent refactorings (injectable `updaters`/`transformers`, `KeyedI18nLookup`) have improved the
codebase considerably. The following analysis identifies **14 violations** and **4 code smells**
that remain.

The most impactful improvements are:
1. Naming the implicit storage-backend **Strategy** (the `fs?: Editor` threading)
2. Fixing **DIP** on `doesExist` and `existsSync` (both bypass the mem-fs abstraction)
3. Completing the **OCP** fix in `printPropertiesI18nAnnotation` (`typeof` dispatch)
4. Splitting the mixed-responsibility `PropertiesTokenizer` / `CsvTokenizer` (**SRP**)

---

## SOLID Principles

### SRP — Single Responsibility Principle

#### SRP-1 `PropertiesTokenizer` mixes cursor management, token consumption, and character classification

**File:** [src/parser/properties/lexer/index.ts:10-371](src/parser/properties/lexer/index.ts#L10-L371)
**Severity:** Moderate

The class bundles three distinct concerns in one file:

| Concern | Location |
|---|---|
| Character classification | Module-level helpers `isWhitespace`, `isEscape`, `isSeparator`, … |
| Cursor / stream management | Class fields `offset`, `peek()`, `next()`, `getImage()` |
| Token state machine | `consumeKey()`, `consumeValue()`, `consumeEscape()`, … |

**Why it is a violation:** A grammar rule change (e.g., new separator character) and a stream
refactor (e.g., switching to a `Buffer` view) each touch the same file.

**Proposed split:**
- `char-classifier.ts` — pure functions: `isWhitespace`, `isEscape`, `isSeparator`, `isValue`, …
- `CharStream` (inline helper or separate class) — `peek`, `next`, `getImage`, cursor state
- `PropertiesTokenizer` — only the `consume*` state machine, delegates to the above

---

#### SRP-2 `CsvTokenizer.createToken` drives iteration, dispatches, and emits tokens

**File:** [src/parser/csv/lexer/index.ts:18-137](src/parser/csv/lexer/index.ts#L18-L137)
**Severity:** Moderate

`createToken(text)` is misnamed — it is actually the entire tokenization loop. It simultaneously:
1. Iterates over characters (`while (this.i < text.length)`)
2. Dispatches to `handleSeparatorOrNewLine` and `handleQuotedCharacter`
3. Mutates `this.value`, `this.start`, and pushes `Token` objects

**Why it is a violation:** The CSV grammar (iteration concern) and the token format (emission
concern) have independent reasons to change. Two separate teams could both need to edit this one
method.

---

#### SRP-3 `writeToExistingI18nPropertiesFile` mixes read, transform, and write

**File:** [src/write/utils/index.ts:39-52](src/write/utils/index.ts#L39-L52)
**Severity:** Moderate

```typescript
// ❌ Three responsibilities in one function
export async function writeToExistingI18nPropertiesFile(...): Promise<boolean> {
    let content = await readFile(i18nFilePath, fs);          // I/O: read
    if (keysToRemove.length) {
        content = removeKeysFromI18nPropertiesFile(content, keysToRemove);  // transform #1
    }
    const addition = prependGapIfNeeded(content, formatNewEntries(newI18nEntries)); // transform #2
    await writeFile(i18nFilePath, content.concat(addition), fs);  // I/O: write
    return true;
}
```

**Why it is a violation:** The adjacent `tryUpdateFile` (same file, [src/write/utils/index.ts:17-28](src/write/utils/index.ts#L17-L28)) already shows the
correct pattern — it accepts an injected `transform: (content: string) => string` callback and
handles only I/O. `writeToExistingI18nPropertiesFile` does not follow this established convention.

**Proposed fix:** Extract a pure `applyPropertiesFileChanges(content, newEntries, keysToRemove)`
function and delegate to `tryUpdateFile` (or an equivalent wrapper).

---

#### SRP-4 `addJsonTexts` mixes empty-document guard, parsing, structure detection, and edit routing

**File:** [src/write/cap/json.ts:102-142](src/write/cap/json.ts#L102-L142)
**Severity:** Minor

The 40-line function performs: (1) empty-string guard, (2) JSON AST parse, (3) locale node lookup,
(4) EOL/indent discovery, (5) routing to one of two edit helpers. Each step has a different reason
to change.

---

#### SRP-5 `ParseCsv` constructor runs the lexer as a side-effect

**File:** [src/parser/csv/parser/csv-parser.ts:18-24](src/parser/csv/parser/csv-parser.ts#L18-L24)
**Severity:** Minor

```typescript
constructor(text: string) {
    this.tokens = tokenize(text);   // ← full lexer runs at construction time
    ...
}
```

Construction and tokenization are separate concerns. The class cannot be constructed without
immediately processing the input, making it impossible to inject pre-tokenized input (e.g., in
tests).

---

#### SRP-6 `path.ts` mixes pure path construction with async filesystem existence check

**File:** [src/utils/path.ts:1-53](src/utils/path.ts#L1-L53)
**Severity:** Minor

`jsonPath`, `capPropertiesPath`, `csvPath` are pure string transforms. `doesExist` is async Node.js
I/O. These change for different reasons and should live in separate modules.

---

#### SRP-7 `types.ts` aggregates three unrelated type groups

**File:** [src/types.ts:6-163](src/types.ts#L6-L163)
**Severity:** Minor

The file contains: i18n domain types, SAP text type enums (34 members), and CDS configuration
types. These are governed by three different external specifications.

**Proposed split:**
```
src/types/
  i18n.ts     — I18nEntry, I18nBundle, NewI18nEntry, …
  sap-text.ts — SapShortTextType, SapLongTextType, SapTextType, …
  cds.ts      — CdsEnvironment, CdsI18nConfiguration, …
  index.ts    — backward-compat barrel re-export
```

---

### OCP — Open/Closed Principle

#### OCP-1 `printPropertiesI18nAnnotation` branches on annotation type at runtime

**File:** [src/utils/print.ts:12-38](src/utils/print.ts#L12-L38)
**Severity:** High

```typescript
export function printPropertiesI18nAnnotation(text: string, annotation?: string | I18nAnnotation): string {
    if (!annotation) { /* auto-derive */ }
    if (typeof annotation === 'string') { return `${getAnnotationPrefix(text)}${annotation}`; }
    if (typeof annotation === 'object') { /* destructure I18nAnnotation */ }
    return '';
}
```

**Why it is a violation:** Adding a fourth annotation variant (e.g., a DSL object or a raw-comment
type) requires opening and editing this function. The type-switch is the classic OCP anti-pattern.

**Proposed refactoring:** Introduce an `AnnotationPrinter` interface with `print(text): string` and
three implementations (`DefaultAnnotationPrinter`, `StringAnnotationPrinter`,
`ObjectAnnotationPrinter`). A factory `annotationPrinterFor(annotation)` selects the right
implementation once; the main function becomes a single delegation call — closed for modification.

---

#### OCP-2 `parser/index.ts` requires editing both the `FileFormat` enum and the dispatch map to add a format

**File:** [src/parser/index.ts:8-26](src/parser/index.ts#L8-L26)
**Severity:** High

```typescript
const parsers: Partial<Record<FileFormat, Parser>> = {
    [FileFormat.properties]: parseProperties,
    [FileFormat.csv]: parseCsv
    // ← new format? Must add FileFormat enum value AND add entry here
};
```

**Why it is a violation:** `FileFormat.json` already exists in the enum but has no parser entry —
the asymmetry will throw at runtime. Any new format requires editing two files.

**Proposed refactoring:** Replace the closed enum + static record with an open, injectable
`ParserRegistry`:

```typescript
export function createParserRegistry(): ParserRegistry {
    const parsers = new Map<string, Parser>();
    return {
        register(format, parser) { parsers.set(format, parser); },
        parse(text, format) { ... }
    };
}
// Adding a new format: defaultRegistry.register('xml', parseXml) — zero existing files touched
```

---

#### OCP-3 `toKeyedLookup` contains a residual `Array.isArray` type dispatch

**File:** [src/utils/key.ts:16-21](src/utils/key.ts#L16-L21)
**Severity:** Low

```typescript
export function toKeyedLookup(data: I18nEntry[] | I18nBundle): KeyedI18nLookup {
    if (Array.isArray(data)) { ... }   // ← runtime type inspection
    return { hasKey: (key) => data[key] !== undefined };
}
```

**Why it is a violation:** The `KeyedI18nLookup` abstraction was introduced to eliminate exactly
this branch. Adding a third data shape (e.g., `Map<string, I18nEntry>`) requires reopening this
function.

**Proposed fix:** Replace with two explicit factory functions `lookupFromEntries` and
`lookupFromBundle`; keep `toKeyedLookup` as a backward-compat shim that delegates.

---

### DIP — Dependency Inversion Principle

#### DIP-1 `doesExist` hardcodes `node:fs.stat` — no mem-fs support

**File:** [src/utils/path.ts:43-53](src/utils/path.ts#L43-L53)
**Severity:** High

```typescript
import { stat } from 'node:fs';  // ❌ hardcoded

export function doesExist(path: string): Promise<boolean> {
    return new Promise((resolve) => {
        stat(path, (err) => { resolve(!err); });  // ❌ always real filesystem
    });
}
```

**Why it is a violation:** All sibling I/O helpers ([`readFile`](src/utils/mem-fs-editor/read.ts),
[`writeFile`](src/utils/mem-fs-editor/write.ts)) accept `fs?: Editor` and branch on
it. `doesExist` does not — it is invisible to the in-memory filesystem. A file written only to
`mem-fs` will not be found by `doesExist`, creating a silent consistency hole.

**Proposed fix:**
```typescript
export function doesExist(path: string, fs?: Editor): Promise<boolean> {
    if (fs) return Promise.resolve(fs.exists(path));
    return new Promise((resolve) => { stat(path, (err) => resolve(!err)); });
}
```

---

#### DIP-2 `resolveCapI18nFolderForFile` calls `existsSync` — hardcoded sync filesystem

**File:** [src/utils/resolve.ts:2](src/utils/resolve.ts#L2), [src/utils/resolve.ts:54](src/utils/resolve.ts#L54)
**Severity:** High

```typescript
import { existsSync } from 'node:fs';  // ❌ hardcoded sync fs

if (existsSync(folderPath)) { return folderPath; }  // ❌ no injection point
```

**Why it is a violation:** The folder-discovery function is domain logic (which i18n folder to
use?), yet it directly depends on synchronous Node.js I/O. It is untestable without real directories
on disk.

**Proposed fix:** Accept an injectable `folderExists: (path: string) => boolean` parameter with
`existsSync` as the default. Tests pass a `Set<string>` backed stub.

---

#### DIP-3 `createCapI18nEntries` calls `promises.mkdir` directly

**File:** [src/write/cap/create.ts:56-57](src/write/cap/create.ts#L56-L57)
**Severity:** Medium

```typescript
import { promises } from 'node:fs';  // ❌ concrete import in high-level orchestration

await promises.mkdir(i18nFolderPath);  // ❌ bypasses the fs?: Editor abstraction
```

**Why it is a violation:** The same function correctly delegates `readFile`/`writeFile` through the
`fs?: Editor` injection point, then calls `mkdir` directly — breaking the abstraction it establishes.

**Proposed fix:** Add an injectable `mkDir: (dir: string) => Promise<void>` parameter with
`(dir) => promises.mkdir(dir)` as the default.

---

#### DIP-4 `normalizePath` reads `process.platform` directly

**File:** [src/utils/resolve.ts:13-16](src/utils/resolve.ts#L13-L16)
**Severity:** Low

```typescript
if (process.platform === 'win32') { ... }  // ❌ global runtime dependency
```

**Why it is a violation:** The Node.js `process` global is a concrete dependency injected into
domain logic. This makes `normalizePath` impossible to test for the Windows branch on a non-Windows
machine without monkey-patching a global.

**Proposed fix:** Accept `isWin32 = process.platform === 'win32'` as a default parameter.

---

## GoF Design Patterns

### Patterns Present

| # | Pattern | File(s) | Assessment |
|---|---|---|---|
| 1 | **Strategy** (×3) | [src/parser/index.ts:8-26](src/parser/index.ts#L8-L26), [src/read/cap/bundle.ts:1-103](src/read/cap/bundle.ts#L1-L103), [src/write/cap/create.ts:1-72](src/write/cap/create.ts#L1-L72) | Well-applied. `BundleTransformer` (read-side), `CapI18nUpdater` (write-side), and the `parsers` record (parse-side) are three independent uses of the Strategy pattern via function-type interfaces. |
| 2 | **Chain of Responsibility** | [src/read/cap/bundle.ts:1-103](src/read/cap/bundle.ts#L1-L103), [src/write/cap/create.ts:1-72](src/write/cap/create.ts#L1-L72) | Well-applied. Both functions iterate an ordered handler list and stop on first success. The handler list is fully injectable. |
| 3 | **Iterator** (hand-rolled) | [src/parser/properties/lexer/index.ts:10-371](src/parser/properties/lexer/index.ts#L10-L371), [src/parser/csv/lexer/index.ts:18-137](src/parser/csv/lexer/index.ts#L18-L137) | All four lexer/parser classes implement a cursor-based iterator (`peek`, `next`/`consume`, terminal getter). Not `Symbol.iterator`, but canonical GoF Iterator. |
| 4 | **State** (inline) | [src/parser/csv/lexer/index.ts:21](src/parser/csv/lexer/index.ts#L21) | `CsvTokenizer.mode: 'default' \| 'quoted'` is an enum-based State pattern. The entire `createToken` loop branches on this field. Works for two states; will become a smell if states grow (see BOO-SMELL-4). |
| 5 | **Adapter** | [src/utils/key.ts:6-21](src/utils/key.ts#L6-L21) | `toKeyedLookup()` adapts `I18nEntry[]` and `I18nBundle` to the `KeyedI18nLookup` interface. Clean object-adapter via factory function. |
| 6 | **Interpreter** (partial) | [src/parser/](src/parser/) layer | Two-stage Lexer → Parser pipeline produces typed AST nodes. Evaluation is delegated to the transformer layer rather than encoded in `interpret()` methods on nodes — making this a partial Interpreter. |

---

### Patterns Absent — Opportunities

#### DP-OPP-1 Unnamed Storage-Backend Strategy (most impactful)

**Evidence:** Every I/O function in [src/utils/mem-fs-editor/](src/utils/mem-fs-editor/)
has `fs?: Editor` as a trailing parameter. The `if (fs) { … } else { … }` branch is duplicated in
[`readFile`](src/utils/mem-fs-editor/read.ts),
[`writeFile`](src/utils/mem-fs-editor/write.ts), and ~10 call sites.

**Opportunity:** This is the Strategy pattern waiting to be named. Define a `StorageBackend`
interface:

```typescript
interface StorageBackend {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdir(dir: string): Promise<void>;
}
```

Provide `NodeFsBackend` and `MemFsBackend` implementations. Inject once at the top-level entry
point. This eliminates the `fs?: Editor` parameter from every function signature and the duplicated
`if (fs)` branches throughout the codebase.

---

#### DP-OPP-2 Facade over the public API

**Evidence:** [src/index.ts:1-34](src/index.ts#L1-L34) re-exports 20+ symbols from 6
sub-packages. Consumers must assemble calls themselves, passing the same `root`, `env`, and `fs`
arguments repeatedly.

**Opportunity:** A `I18nService` class (or Facade) that accepts `root`, `env`, and `backend` once
in its constructor and exposes `read(path)` / `write(path, entries)` methods would simplify consumer
code and hide the sub-package structure.

---

#### DP-OPP-3 Template Method for the read/write orchestration skeleton

**Evidence:** [`getCapI18nBundle`](src/read/cap/bundle.ts) and
[`createCapI18nEntries`](src/write/cap/create.ts) both follow the same skeleton:
resolve config → resolve paths → iterate handlers → merge/return.

**Opportunity:** An abstract `I18nOrchestrator<T>` with `protected abstract getHandlers(): T[]`
and a concrete `execute()` template would DRY up the two orchestration functions.

---

#### DP-OPP-4 Builder for long optional-parameter lists

**Evidence:** [`createCapI18nEntries`](src/write/cap/create.ts) has six parameters,
two of them optional positional placeholders: `createCapI18nEntries(root, path, entries, env, fs?, updaters?)`.

**Opportunity:** A `CapI18nWriteRequestBuilder` with fluent chaining would eliminate `undefined`
positional placeholders and make call sites readable.

---

## Beyond-OO Patterns

### Beyond-OO Patterns Present

| # | Pattern | File(s) | Assessment |
|---|---|---|---|
| 1 | **Pipes and Filters** | [src/read/cap/bundle.ts:1-103](src/read/cap/bundle.ts#L1-L103), [src/write/cap/create.ts:1-72](src/write/cap/create.ts#L1-L72) | `BundleTransformer[]` and `CapI18nUpdater[]` form ordered pipelines with short-circuit semantics. Injectable and composable. |
| 2 | **Service Layer** | [src/index.ts:1-34](src/index.ts#L1-L34) | `getCapI18nBundle`, `createCapI18nEntries`, `createPropertiesI18nEntries`, `removeAndCreateI18nEntries` are the service boundary — they orchestrate I/O and coordinate sub-operations. |
| 3 | **Hexagonal / Ports & Adapters** | `BundleTransformer` (port) in [src/read/cap/bundle.ts:19-22](src/read/cap/bundle.ts#L19-L22), `CapI18nUpdater` (port) in [src/write/cap/create.ts:17-24](src/write/cap/create.ts#L17-L24) | Read-side and write-side ports are well-defined interfaces. Domain logic depends only on the port, not the concrete adapter. Well-applied. |
| 4 | **Pure Functions** | [src/utils/annotation.ts:1-45](src/utils/annotation.ts#L1-L45), [src/utils/print.ts:1-54](src/utils/print.ts#L1-L54), [src/utils/string-case.ts:1-51](src/utils/string-case.ts#L1-L51), [src/transformer/](src/transformer/) layer | The majority of utility and transformer functions are pure: no side effects, no mutation of arguments, deterministic output. This is the dominant functional style. |
| 5 | **Promises / async-await** | All I/O entry points | Pervasive `async/await`. One exception: `doesExist` wraps a callback-based `fs.stat` in a manual `new Promise(…)` instead of using `fs/promises.stat` (see DIP-1 / BOO-SMELL-2). |
| 6 | **Recursion** | [src/utils/key.ts:1-92](src/utils/key.ts#L1-L92) — `findUniqueKey`, [src/utils/resolve.ts:1-110](src/utils/resolve.ts#L1-L110) — `resolve` | Both recursive functions have clear base cases. `findUniqueKey` recurses with an incremented counter; `resolve` walks the directory tree upward. Both are correct. |
| 7 | **Revealing Module** | All `index.ts` barrels | Every sub-directory curates a public API via `index.ts`. Internal helpers remain unexported. [src/utils/text.ts:1-4](src/utils/text.ts#L1-L4) is an explicit backward-compat barrel. Clean module encapsulation. |
| 8 | **External Configuration Store** | [src/utils/config.ts:1-33](src/utils/config.ts#L1-L33) | `getI18nConfiguration(env)` reads externally supplied CDS config and provides defaults. Configuration flows in from outside, not hardcoded in logic. |
| 9 | **Dependency Injection** | [src/read/cap/bundle.ts:1-103](src/read/cap/bundle.ts#L1-L103), [src/write/cap/create.ts:1-72](src/write/cap/create.ts#L1-L72) | `transformers?` and `updaters` parameters are manual constructor-style DI. Default implementations are supplied as default arguments. `fs?: Editor` is also a form of DI (see DIP-1 for the partial violation). |

---

### Beyond-OO Code Smells

#### BOO-SMELL-1 Sequential async loop where parallel resolution is possible

**File:** [src/read/cap/bundle.ts:84-99](src/read/cap/bundle.ts#L84-L99)
**Description:** `for (const path of i18nFileLocations)` with `await tryTransformTexts(…)` inside
reads each file serially. If the file list grows (e.g., many CDS services), this is a latent
performance issue.
**Fix:** `await Promise.all(i18nFileLocations.map(path => tryTransformTexts(…)))` with a subsequent
merge step.

---

#### BOO-SMELL-2 Callback-wrapped Promise (outdated style)

**File:** [src/utils/path.ts:43-53](src/utils/path.ts#L43-L53)
**Description:** `doesExist` manually wraps `fs.stat` callback in `new Promise(…)`. The rest of the
codebase uses `fs.promises` (or `async/await`). This is inconsistent and verbose.
**Fix:** Use `fs/promises.access(path).then(() => true, () => false)` or `fs.promises.stat`.

---

#### BOO-SMELL-3 `string | I18nAnnotation` bare union causes a dead branch

**File:** [src/types.ts:49](src/types.ts#L49) — `NewI18nEntry.annotation`, [src/utils/print.ts:19-37](src/utils/print.ts#L19-L37)
**Description:** `annotation?: I18nAnnotation | string` on `NewI18nEntry` surfaces as a `typeof`
dispatch in `printPropertiesI18nAnnotation` ([src/utils/print.ts:19-23](src/utils/print.ts#L19-L23)).
After the `typeof === 'string'` and `typeof === 'object'` branches, no further type is possible —
making the `return ''` on line 37 unreachable dead code. The claim that `getAnnotation` is a second
affected site is **incorrect**: `getAnnotation` ([src/transformer/properties/annotation.ts:92](src/transformer/properties/annotation.ts#L92))
parses a `PropertyLine` into `I18nAnnotationNode` and does not touch this union at all.
**Scope correction:** The smell is narrow — a single function with one unreachable branch. It is a
symptom of the same root cause as OCP-1 rather than an independent issue. The discriminated-union
fix is over-engineered for this scope; the OCP-1 `AnnotationPrinter` refactoring subsumes it.

---

#### BOO-SMELL-4 Inline State pattern will not scale beyond two states

**File:** [src/parser/csv/lexer/index.ts:21](src/parser/csv/lexer/index.ts#L21)
**Description:** `CsvTokenizer.mode: 'default' | 'quoted'` is an enum-based inline State pattern.
It works for two states but if a third (e.g., `'escaped'`) is ever needed, the branching in
`createToken` and its dispatch methods will grow to an unmanageable switch.
**Fix (if states grow):** Extract `DefaultMode` and `QuotedMode` state classes implementing a
shared `TokenizerMode` interface, each owning its character-handling logic.

---

## Priority Summary

| # | ID | File | Severity | Category | Description |
|---|---|---|---|---|---|
| 1 | DIP-1 | [src/utils/path.ts:43-53](src/utils/path.ts#L43-L53) | **High** | DIP | `doesExist` bypasses `mem-fs` — files written to in-memory FS are invisible |
| 2 | DIP-2 | [src/utils/resolve.ts:54](src/utils/resolve.ts#L54) | **High** | DIP | `existsSync` hardcoded in domain logic — untestable without real disk |
| 3 | OCP-1 | [src/utils/print.ts:12-38](src/utils/print.ts#L12-L38) | **High** | OCP | `typeof` dispatch on annotation — must edit to add new variant |
| 4 | OCP-2 | [src/parser/index.ts:8-26](src/parser/index.ts#L8-L26) | **High** | OCP | Static enum + registry — must edit both to add a new parser format |
| 5 | SRP-1 | [src/parser/properties/lexer/index.ts:10-371](src/parser/properties/lexer/index.ts#L10-L371) | **Moderate** | SRP | `PropertiesTokenizer` bundles character classification, cursor, and state machine |
| 6 | SRP-2 | [src/parser/csv/lexer/index.ts:18-137](src/parser/csv/lexer/index.ts#L18-L137) | **Moderate** | SRP | `CsvTokenizer.createToken` drives iteration, dispatches, and emits in one method |
| 7 | SRP-3 | [src/write/utils/index.ts:39-52](src/write/utils/index.ts#L39-L52) | **Moderate** | SRP | `writeToExistingI18nPropertiesFile` mixes read, transform, and write |
| 8 | DIP-3 | [src/write/cap/create.ts:56-57](src/write/cap/create.ts#L56-L57) | **Medium** | DIP | `promises.mkdir` called directly inside partially-injected function |
| 9 | DP-OPP-1 | [src/utils/mem-fs-editor/](src/utils/mem-fs-editor/) | **Medium** | GoF Opportunity | Unnamed storage-backend Strategy (`fs?: Editor` threading) |
| 10 | SRP-4 | [src/write/cap/json.ts:102-142](src/write/cap/json.ts#L102-L142) | **Minor** | SRP | `addJsonTexts` mixes four concerns |
| 11 | SRP-5 | [src/parser/csv/parser/csv-parser.ts:18-24](src/parser/csv/parser/csv-parser.ts#L18-L24) | **Minor** | SRP | Constructor runs lexer as side-effect |
| 12 | SRP-6 | [src/utils/path.ts:1-53](src/utils/path.ts#L1-L53) | **Minor** | SRP | Path helpers and `doesExist` in same module |
| 13 | SRP-7 | [src/types.ts:6-163](src/types.ts#L6-L163) | **Minor** | SRP | Three unrelated type groups in one file |
| 14 | OCP-3 | [src/utils/key.ts:16-21](src/utils/key.ts#L16-L21) | **Low** | OCP | Residual `Array.isArray` branch — `KeyedI18nLookup` abstraction already present |
| 15 | DIP-4 | [src/utils/resolve.ts:13-16](src/utils/resolve.ts#L13-L16) | **Low** | DIP | `process.platform` read directly in domain logic |
| 16 | BOO-SMELL-1 | [src/read/cap/bundle.ts:84-99](src/read/cap/bundle.ts#L84-L99) | **Low** | BOO | Sequential async loop where `Promise.all` would be faster |
| 17 | BOO-SMELL-2 | [src/utils/path.ts:43-53](src/utils/path.ts#L43-L53) | **Low** | BOO | Manual `new Promise(…)` wrapping a callback where `fs/promises` exists |
| 18 | BOO-SMELL-3 | [src/types.ts:49](src/types.ts#L49), [src/utils/print.ts:19-37](src/utils/print.ts#L19-L37) | **Low** | BOO | `string \| I18nAnnotation` union produces an unreachable `return ''` branch; `getAnnotation` is not affected (incorrect claim corrected) |
| 19 | BOO-SMELL-4 | [src/parser/csv/lexer/index.ts:21](src/parser/csv/lexer/index.ts#L21) | **Low** | BOO | Inline State pattern will not scale beyond two states |
