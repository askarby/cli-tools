# AGENTS.md

TypeScript CLI tools for personal development machines. Each command is a TypeScript file run directly with [tsx](https://tsx.is) (no build step), started through a thin bash launcher that is symlinked into `~/.bin`.

## Stack

- Node.js, ESM TypeScript (`"type": "module"`), run with repo-local `tsx`.
- Node version: `.tool-versions` pins `nodejs 24.11.1` (ASDF), `.nvmrc` says `22`, `package.json` requires `>=22`. These differ; don't "fix" one without asking.
- Runtime dependencies (only these): commander, yaml, smol-toml (`herdrinator`, `dotty`), @clack/prompts (`dotty`, interactive prompts). Dev dependencies: typescript, typescript-eslint, eslint, prettier, tsx, vitest, @types/node.

## Commands

| Command                      | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `npm run check`              | format:check + typecheck + lint + test (= CI)  |
| `npm run new-tool -- <name>` | scaffold a new tool (see `new-tool` skill)     |
| `npm run typecheck`          | `tsc --noEmit` (covers `src/` and `scripts/`)  |
| `npm run lint`               | `eslint .`                                     |
| `npm run format`             | `prettier --write .`                           |
| `npm run format:check`       | `prettier --check .` (used by CI)              |
| `npm test`                   | `vitest run` (`npm run test:watch` to watch)   |
| `./install.sh`               | Install deps and symlink `bin/*` into `~/.bin` |

CI (`.github/workflows/ci.yml`) runs one parallel pipeline per tool: format -> lint -> typecheck -> test -> build (launcher smoke run), defined once in `tool-pipeline.yml`. Locally, run `npm run check` (+ run the command by hand).

## Layout

```
bin/<name>             executable bash launcher (only executables live here)
shell/_common.sh        shared launcher logic (sourced, not executed)
src/tools/<name>.ts one TypeScript entrypoint per tool
src/lib/<name>/        per-tool code; src/lib/shared/ holds code used by several tools
                       (tests sit beside the code as *.test.ts)
install.sh             idempotent installer; never deletes anything
```

## Skills

Task-specific guidance lives in `.agents/skills/<name>/SKILL.md`. Read the relevant one before working in that area (they are also exposed to Claude Code as skills via `.claude/skills`). Working in `src/lib/<tool>/`? Read that folder's `AGENTS.md` first.

- `new-tool`: **start here to add a command**: generator, checklist, catalogue of `src/lib/shared/`.
- `architecture`: how the repo fits together.
- `typescript`: conventions for anything under `src/`.
- `bash`: conventions for `bin/`, `shell/` and `install.sh`.
- `testing`: how to test commands and library code with Vitest.
- `safety`: rules for anything that deletes, overwrites or executes; read before writing any "clean up" style code.

## Rules

- Before finishing a change, run `npm run check`. New commands and lib code come with tests.
- Don't add runtime dependencies without asking. Prefer Node built-ins (e.g. `node:util` `parseArgs` for simple commands).
- Never make `install.sh` or any launcher delete user files; report and suggest instead.
- All file deletion in TypeScript goes through `safeRemove` in `src/lib/shared/safety.ts` (or `safeUnlink` for removing symlinks that point into a given root, e.g. `dotty`); never call `rmSync`/`unlink` directly. Read the `safety` skill first.
- Tests never touch the real home, config or `~/.bin`, and never run the real `herdr`; use `createSandbox()` and fakes (see `testing`).
- Keep `bin/` to executables only.
- Don't commit unless asked.

## Working notes

- `ls` may be aliased in the maintainer's shell and reject paths: use `git ls-files` (or the Glob/Read tools) to list files.
- Bash `cd` persists between calls: use absolute paths.
- New tool: read the `new-tool` skill and run the generator. Don't spawn an exploration agent to learn conventions; they are written down.
- Document behaviour users must know in the tool's `--help` text and its `src/lib/<tool>/AGENTS.md`, not only the README.
- Temp files and scratch repos go in the session scratchpad, not `/tmp` or the repo.
