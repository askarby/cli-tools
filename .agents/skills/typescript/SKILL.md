---
name: typescript
description: TypeScript conventions for cli-tools (ESM, strict, tsx, Prettier, ESLint). Use when writing or editing anything under src/, including new command files and shared library code.
---

# TypeScript conventions

## Module system

- ESM only (`"type": "module"`). No `require`, no CommonJS.
- Import local files **with the `.ts` extension**: `import { log } from "../lib/log.ts";` (`allowImportingTsExtensions` is on).
- Import Node built-ins with the `node:` prefix: `node:util`, `node:fs`, `node:path`.
- `verbatimModuleSyntax` is on: use `import type { ... }` for type-only imports.

## Type safety

- `strict` and `noUncheckedIndexedAccess` are enabled. Array and record index access may be `undefined`; handle it.
- Give exported functions explicit return types (`: void`, `: never`, ...).
- Avoid `any`; the lint config is typescript-eslint `recommended`.

## Style

Enforced by Prettier and `.editorconfig`: double quotes, semicolons, trailing commas everywhere, 2-space indent, LF, final newline. Run `npm run format` rather than hand-formatting. Prefer arrow-function exports:

```ts
export const log = (message: string): void => {
  console.log(message);
};
```

## Command pattern

Each tool is a top-level script in `src/tools/<name>.ts`, with no exported API. Parse arguments with `node:util` `parseArgs` for simple single-purpose commands; commands with subcommands (e.g. `herdrinator`) use `commander`, one module per subcommand exporting `register(program)`. Print with `log`, and fail with `fail`:

```ts
import { parseArgs } from "node:util";
import { fail, log } from "../lib/log.ts";

const { values } = parseArgs({
  options: { name: { type: "string", short: "n", default: "world" } },
});

if (values.name === "") fail("--name must not be empty");

log(`Hello, ${values.name}!`);
```

- `log(message)` writes to stdout. `fail(message, code = 1)` writes to stderr and exits (returns `never`).
- Put reusable code in `src/lib/`; keep command files thin.
- Don't add runtime dependencies without asking.

## Before finishing

```
npm run typecheck && npm run lint
npm run format
```

There is no test framework. Run the command by hand (`npx tsx src/tools/<name>.ts ...`) to check behaviour.
