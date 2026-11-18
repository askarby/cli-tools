# Contributing

Thanks for helping out. This page covers how the repo fits together, the tooling, and how to add or change a tool. For AI-assisted work, see [LLM.md](LLM.md).

## Setup

Follow "Getting started" in the [README](README.md) (`./install.sh`). The stack is Node.js with ESM TypeScript (`"type": "module"`), run with the repo-local `tsx`.

Node versions: `.tool-versions` pins `nodejs 24.11.1` (asdf), `.nvmrc` says `22`, and `package.json` requires `>=22`. These differ; please ask before changing one.

## Layout

```
bin/<name>             executable bash launcher (only executables live here)
shell/_common.sh       shared launcher logic (sourced, not executed)
src/tools/<name>.ts    one thin TypeScript entrypoint per tool
src/lib/<name>/        per-tool code, README.md and AGENTS.md
src/lib/shared/        code used by several tools
scripts/               repo-development scripts (such as `npm run new-tool`)
install.sh             idempotent installer; never deletes anything
```

Tests sit beside the code as `*.test.ts`.

## Commands

| Command                      | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `npm run check`              | format:check + typecheck + lint + test (= CI)  |
| `npm run new-tool -- <name>` | scaffold a new tool                            |
| `npm run typecheck`          | `tsc --noEmit` (covers `src/` and `scripts/`)  |
| `npm run lint`               | `eslint .`                                     |
| `npm run format`             | `prettier --write .`                           |
| `npm test`                   | `vitest run` (`npm run test:watch` to watch)   |
| `./install.sh`               | install deps and symlink `bin/*` into `~/.bin` |

Run `npm run check` before you finish a change, and run the command by hand too.

## Continuous integration

`.github/workflows/ci.yml` runs one parallel pipeline per tool: format, lint, typecheck, test, then a build step that smoke-runs the launcher. The pipeline is defined once in `tool-pipeline.yml`.

## Adding a tool

```sh
npm run new-tool -- <name>
```

This creates the launcher, entrypoint, library skeleton, a test, the tool's `README.md` and `AGENTS.md`, a CI job, and a row in the tools table of the root README. Then follow the checklist in `.agents/skills/new-tool/SKILL.md`, which also lists the reusable code in `src/lib/shared/`.

Each tool needs:

- tests for the commands and library code
- a short `src/lib/<name>/README.md` that introduces the tool (what and why, requirements, where config lives). Do not repeat what `--help` says: commands and options are documented in the help text
- notes for working on it in `src/lib/<name>/AGENTS.md`

## Rules of the house

- No new runtime dependencies without discussion. Prefer Node built-ins (`node:util` `parseArgs` for simple commands).
- Deleting goes through `safeRemove` (or `safeUnlink` for symlinks) in `src/lib/shared/safety.ts`, never `rmSync` or `unlink`. Installers and launchers never delete user files: they report and suggest.
- Tests never touch the real home directory, config or `~/.bin`, and never run external tools for real. Use `createSandbox()` and fakes.
- No emojis in command documentation (descriptions, help text and docs). Emojis are for runtime output only.
- Tools are independent of how their config is stored: only `dotty` knows about dotfiles managers.
- Keep `bin/` to executables only.

Longer guidance lives in `.agents/skills/` (`architecture`, `typescript`, `bash`, `testing`, `safety`, `new-tool`). They are written for agents, but are just as useful to read as a person.
