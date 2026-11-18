---
name: architecture
description: How the cli-tools repository is structured and how a command runs from the shell to TypeScript. Use when adding, renaming or removing a command, touching install.sh, or deciding where new code belongs.
---

# cli-tools architecture

## Layout

```
bin/<name>              bash launcher, one per command (executables only)
shell/_common.sh        shared launcher logic, sourced by every launcher (guarded: errors if executed)
src/tools/<name>.ts  TypeScript entrypoint, one per tool
src/lib/                per-tool code in src/lib/<tool>/ (+ its AGENTS.md); src/lib/shared/ is cross-tool (catalogue in the `new-tool` skill)
scripts/                repo-dev scripts (new-tool.ts), not user commands
src/**/*.test.ts        Vitest tests, next to the code they test (see the `testing` skill)
install.sh              installs deps, symlinks bin/* into ~/.bin
```

## How a command runs

1. The user runs `<name>` (a symlink in `~/.bin` to `bin/<name>`).
2. `bin/<name>` resolves its own symlink, sources `shell/_common.sh`, and calls `run_tool <name> "$@"`.
3. `run_tool` runs `_preflight` (node on PATH, `node_modules/.bin/tsx` present) and then `exec`s `tsx src/tools/<name>.ts "$@"`.

The name passed to `run_tool` must match the file name in `src/tools/`.

## Adding a command

Use the `new-tool` skill: `npm run new-tool -- <name>` scaffolds everything below and the skill has the checklist. By hand, the steps are:

1. Create `src/tools/<name>.ts` (see the `typescript` skill) and the code in `src/lib/<name>/`.
2. Copy `bin/hello` to `bin/<name>` (add `require_command <tool> <hint>` before `run_tool` if the command needs an external tool; the check is skipped for `--help`, so the tool must handle `--help` itself) and change the last line to `run_tool <name> "$@"`. `chmod +x bin/<name>`.
3. Add tests next to the lib code (`testing` skill).
4. Add a job for it in `.github/workflows/ci.yml` (`tool-pipeline.yml`: `tool`, `lint-paths`, `test-paths`, `smoke-args: --help`).
5. Add a README section and `src/lib/<name>/AGENTS.md`.
6. Run `npm run check`, then `./install.sh` and try the command.

Put code used by more than one command in `src/lib/shared/`, not in a tool file. Put launcher logic shared by all commands in `shell/_common.sh`, not in individual launchers.

## Design decisions (keep these)

- **No build step.** Commands run straight from source through repo-local `tsx`. Don't add a compile/dist step.
- **Few runtime dependencies.** Prefer Node built-ins. Approved exceptions: `commander` (CLI parsing), `yaml` and `smol-toml` (config files), both for `herdrinator`/`dotty`; `@clack/prompts` (interactive prompts, `dotty`). Ask before adding more.
- **Bash is only a launcher.** Real logic belongs in TypeScript; launchers just locate the repo and hand off.
- **`install.sh` is idempotent and non-destructive.** Existing links are left alone, conflicts are reported, dead links are listed with a suggested `rm` for the user to run.
- **`bin/` holds only executables.** `install.sh` warns about anything else.

## Known quirks

- Node versions differ: `.tool-versions` 24.11.1, `.nvmrc` 22, `engines` `>=22`.
- `tsconfig.json` includes `src/` and `scripts/`, so typecheck doesn't cover config files.

## Per-tool notes

Each tool documents itself in `src/lib/<tool>/AGENTS.md` (purpose, config, invariants, quirks). Working in a tool? Read that file first; it is not repeated here.
