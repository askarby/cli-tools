# AGENTS.md

TypeScript CLI tools for personal development machines. Each command is a TypeScript file run directly with [tsx](https://tsx.is) (no build step), started through a thin bash launcher that is symlinked into `~/.bin`.

## Stack

- Node.js, ESM TypeScript (`"type": "module"`), run with repo-local `tsx`.
- Node version: `.tool-versions` pins `nodejs 24.11.1` (ASDF), `.nvmrc` says `22`, `package.json` requires `>=22`. These differ; don't "fix" one without asking.
- Runtime dependencies (only these, for `herdrinator`): commander, yaml, smol-toml. Dev dependencies: typescript, typescript-eslint, eslint, prettier, tsx, @types/node.

## Commands

| Command             | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `npm run typecheck` | `tsc --noEmit` (covers `src/` only)            |
| `npm run lint`      | `eslint .`                                     |
| `npm run format`    | `prettier --write .`                           |
| `./install.sh`      | Install deps and symlink `bin/*` into `~/.bin` |

There is no test framework and no CI. Verification is typecheck + lint (+ running the command by hand).

## Layout

```
bin/<name>             executable bash launcher (only executables live here)
shell/_common.sh        shared launcher logic (sourced, not executed)
src/tools/<name>.ts one TypeScript entrypoint per tool
src/lib/               shared TypeScript code
install.sh             idempotent installer; never deletes anything
```

## Skills

Task-specific guidance lives in `.agents/skills/<name>/SKILL.md`. Read the relevant one before working in that area:

- `architecture`: how the repo fits together, and how to add a new command.
- `typescript`: conventions for anything under `src/`.
- `bash`: conventions for `bin/`, `shell/` and `install.sh`.

## Rules

- Before finishing a change, run `npm run typecheck` and `npm run lint`.
- Don't add runtime dependencies without asking. Prefer Node built-ins (e.g. `node:util` `parseArgs` for simple commands).
- Never make `install.sh` or any launcher delete user files; report and suggest instead.
- Keep `bin/` to executables only.
- Don't commit unless asked.
