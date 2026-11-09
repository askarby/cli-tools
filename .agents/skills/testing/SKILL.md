---
name: testing
description: How to test cli-tools commands and library code with Vitest (unit, command-level and end-to-end smoke tests, temp-dir and env isolation, faking external tools). Use when adding or changing a command, writing or editing any `*.test.ts`, or changing anything under `src/`.
---

# Testing

Reference implementations: `src/lib/herdrinator/paths.test.ts` (env stubbing), `src/lib/shared/safety.test.ts` (filesystem sandbox, destructive-code cases), `src/lib/shared/test-utils.ts` (`createSandbox`).

## Runner and layout

- Vitest. `npm test` (one run), `npm run test:watch`. Config: `vitest.config.ts`. Mocks, env stubs and global stubs are restored automatically after every test.
- Tests are `*.test.ts` **next to the code they test** (`src/lib/foo.ts` → `src/lib/foo.test.ts`). Nothing test-related in `bin/`.
- Import from `vitest` explicitly (`import { describe, expect, it, vi } from "vitest"`); globals are off. Import local files with the `.ts` extension, like all code here.
- Tests are type-checked and linted with everything else (they live in `src/`).

## What to write (in this order of preference)

1. **Unit tests of `src/lib/**`**: parsing, planning, formatting, path logic. Pure in, pure out. This is where most tests belong.
2. **Command-level tests**: call the command in-process (e.g. `run(["start", "bob", "--dry-run"])` for `herdrinator`) with a sandboxed config dir and a fake executor. Assert on captured output, `process.exitCode` and files written.
3. **End-to-end smoke tests** (few, slow): spawn `npx tsx src/tools/<name>.ts …` or `bin/<name>` with `HOME` and `XDG_CONFIG_HOME` pointed into a sandbox and a stub binary first on `PATH`. Use only to prove launcher/entrypoint wiring.

For every command, cover: the happy path, each validation error and its exit code, `--dry-run` causing no side effects, running twice (idempotency), and, for anything destructive, the cases in the `safety` skill.

## Design code so it can be tested

- Tool files stay thin. Logic goes in `src/lib/<tool>/`.
- Pass dependencies in (config dir, env, an `exec` function, output sink) with real defaults, instead of reaching for globals deep in the code. `herdr.ts` already takes `dryRun`; follow that.
- Return values or throw from library code. Only the entrypoint calls `fail` / sets `process.exitCode`.
- Don't call `process.exit` in `src/lib/` (it kills the test worker). If code you are testing does, spy on it (below).

## Isolation rules (not optional)

- **Never touch the real machine.** No real `~/.config`, `~/.bin`, repo files, or real `herdr`. A test that needs files uses a sandbox:

  ```ts
  import { createSandbox, type Sandbox } from "../shared/test-utils.ts";

  let sandbox: Sandbox;
  beforeEach(() => {
    sandbox = createSandbox();
    vi.stubEnv("HOME", sandbox.dir);
    vi.stubEnv("XDG_CONFIG_HOME", join(sandbox.dir, "config"));
  });
  afterEach(() => sandbox.cleanup());
  ```

  `createSandbox()` makes a `mkdtemp` directory and cleans it up through `safeRemove`. Do not write raw `rmSync(..., { recursive: true })` in tests; see the `safety` skill.

- Set env with `vi.stubEnv`, never by assigning `process.env` (stubs are reset automatically). Stub `HOME` **and** `XDG_CONFIG_HOME` before calling code that resolves paths.
- Reset anything else you change: `process.exitCode = undefined` in `afterEach`, `process.chdir` back, etc.
- Tests must not depend on each other, on order, on the user's machine (installed tools, locale, TTY) or on the network.

## Faking external programs

- **Preferred**: inject the exec function and assert on the argv it received.
- Otherwise `vi.mock("node:child_process")` and assert on `execFileSync` / `spawnSync` calls. Never let a test run the real `herdr`, an editor, or `sh -c` with a real command.
- End-to-end: write a stub script into the sandbox, `chmod +x`, prepend its dir to `PATH`; have it append its args to a file you read afterwards.

## Capturing output and exits

```ts
const out = vi.spyOn(console, "log").mockImplementation(() => {});
const err = vi.spyOn(console, "error").mockImplementation(() => {});
// `fail()` calls process.exit and returns never: make it throw instead
vi.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`exit ${code}`);
});
expect(() => fail("boom", 2)).toThrow("exit 2");
expect(err).toHaveBeenCalledWith("boom");
```

Strip ANSI colour before asserting on formatted output. Snapshot only stable, human-readable output, and prefer `toMatchInlineSnapshot` so the expectation is visible in review.

## Definition of done

```
npm run typecheck && npm run lint && npm test
```

New command or lib module without tests is unfinished. A bug fix starts with a failing test that reproduces it.
