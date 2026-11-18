---
name: new-tool
description: Fast path for adding a new command (tool) to cli-tools, plus a catalogue of the reusable code in src/lib/shared/ (ui, errors, prompts, safety, test harness). Use when asked to create, scaffold or add a new tool/command, or before writing helpers that might already exist in shared/.
---

# Adding a new tool

You should not need to explore the repo for conventions. Run the generator, then follow the checklist.

## 1. Scaffold

```
npm run new-tool -- <name> [--dry-run]
```

Name: lowercase letters, digits and `-`, starting with a letter. It refuses to overwrite anything (if any target exists, nothing is written). It creates:

- `bin/<name>`: launcher (copy of `bin/hello`, executable)
- `src/tools/<name>.ts`: thin entry, calls `run(process.argv.slice(2))`
- `src/lib/<name>/cli.ts`: a `CliSpec` (name, description, help text, registrars) plus injectable `Deps = { prompts, isInteractive }`; the commander setup itself lives in `shared/cli.ts`
- `src/lib/<name>/commands/hello.ts`: example command; replace it
- `src/lib/<name>/commands.test.ts`: command-level test using the shared harness
- `src/lib/<name>/AGENTS.md`: per-tool notes stub; fill it in
- `src/lib/<name>/README.md`: short intro page stub (what and why, requirements, config location; commands and options belong in `--help`, not here)
- inserts the CI job (`.github/workflows/ci.yml`, before `shared:`) and a row in the root README's tools table (before the `<!-- tools:end -->` marker; run `npm run format` afterwards so Prettier realigns the table)

If an insertion marker is missing it prints the snippet to add by hand.

## 2. Checklist (what is still manual)

- [ ] Replace the example command; one `register(program, deps)` per subcommand in `commands/`.
- [ ] Tests for every command: happy path, each validation error, `--dry-run` has no effects, idempotency (see `testing`). Destructive code: the `safety` skill's test matrix.
- [ ] Fill in `src/lib/<name>/AGENTS.md` (purpose, config, quirks), `src/lib/<name>/README.md` and the one-line summary in the root README's tools table.
- [ ] Describe non-obvious behaviour in `--help` text (`addHelpText`), not only in docs.
- [ ] Command documentation (tool/command descriptions, help text) is plain text: no emojis. Emojis belong only to runtime output via `ui.ts`. `src/lib/shared/cli-docs.test.ts` fails otherwise.
- [ ] Don't mention `dotty`/`stow`/"dotfiles" or assume your config is versioned or symlinked: only `dotty` knows about that. `src/lib/shared/tool-independence.test.ts` fails otherwise.
- [ ] Code that two tools need goes in `src/lib/shared/` and is added to the catalogue below (a test fails if a shared file is missing here).
- [ ] No new runtime dependency without asking. `install.sh` needs no edit (it links everything in `bin/`).
- [ ] `npm run check` (format:check + typecheck + lint + tests), then `./install.sh` and run the command by hand.

## 3. Shared code catalogue (`src/lib/shared/`)

Import with the `.ts` extension, e.g. `import { c, ok } from "../shared/ui.ts"`.

- `cli.ts`: `CliSpec<D> { name, description, helpText?, registrars }`; `buildProgram(spec, deps)` (styled commander program, `-h/--help`, `exitOverride`); `runCli(spec, argv, deps)` (maps `-?` to `--help`, prints help with no args, turns `CliError`/`SafetyError` into `❌ message` + `💡 hint` with exit code 1, maps commander exits, rethrows anything else). A tool's own `cli.ts` just builds a spec and wraps these two.
- `log.ts`: `log(message)`; `fail(message, code = 1): never` (calls `process.exit`; entrypoints only, never library code).
- `ui.ts`: colour via `c.{green,red,yellow,cyan,gray,bold,dim}(text)` (`node:util` `styleText`, no dependency); `say(message = "")`; `ok(m)` (✅), `warn(m)` (⚠️, stderr), `hint(m)` (💡), `step(m)` (›); `displayWidth(text)` (ANSI-stripped, emoji = 2 columns); `table(header: string[], rows: string[][])` (aligned, bold header). Status pills: `🟢 ${c.green("RUNNING")}` style, one emoji + coloured word.
- `errors.ts`: `CliError(message, hint?)` for expected, user-facing failures. Throw it from library code; the tool's `run` prints `❌ message` plus `💡 hint` and sets `process.exitCode = 1`.
- `safety.ts`: `safeRemove(target, { root, dryRun?, maxEntries? })` (the only way to delete; root must hold `.cli-tools-managed`); `safeUnlink(link, { allowedRoot, dryRun? })` (remove a symlink that points inside `allowedRoot`); `SafetyError`, `MANAGED_MARKER`. Read the `safety` skill first.
- `prompts.ts`: `Prompts { text({ message, initialValue?, validate? }), confirm(message), select(message, choices) }` and `clackPrompts` (`@clack/prompts`; cancel throws `CliError`). Inject `Prompts` through `Deps`; refuse (don't prompt) when `!isInteractive()` and no `--yes`.
- `test-utils.ts`: `createSandbox(): { dir, work, cleanup }` (temp dir, cleaned through `safeRemove`).
- `test-harness.ts`: `createEnvironment()` (sandboxed `HOME`/`XDG_CONFIG_HOME` plus `home`, `work`, `write`, `homeFile`, `isLink`, `linkTarget`, `read`, `cleanup`) for non-CLI tests; `createHarness<Deps>({ run, defaultDeps, setup? })` adds captured ANSI-stripped output (`h.cli(args, deps?)` returns stdout+stderr; `h.stdout()` / `h.stderr()` separate them); `fakePrompts(answers)` for scripted answers (records `asked`).

## 4. Patterns to copy (by pointer; read only the one you need)

- A tool's `cli.ts` (spec + `Deps` + two one-line wrappers): `src/lib/dotty/cli.ts`, `src/lib/herdrinator/cli.ts`.
- Config in `$XDG_CONFIG_HOME/<tool>/config.toml` with validation to `CliError`: `src/lib/dotty/config.ts` (`smol-toml`; use `||` not `??` for env fallbacks).
- Plan/apply split with `--dry-run`: `src/lib/dotty/planner.ts` and `apply.ts`.
- Status table with pills, and a doctor-style check list (✅/⚠️/❌, exit 1 on failure): `src/lib/dotty/commands/list.ts`, `doctor.ts`; `src/lib/herdrinator/commands/doctor.ts`.
- Multi-step guided prompts (select, multiselect, path, confirm): `src/lib/dotty/commands/adopt.ts`.
- Wrapping an external binary with an injectable `exec`: `src/lib/herdrinator/herdr.ts`.
