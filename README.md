# cli-tools

TypeScript CLI tools for my development machines. Commands run directly with [tsx](https://tsx.is) — no build step.

## Layout

- `bin/` — one executable bash launcher per command (only executables live here)
- `shell/common.sh` — shared bash logic every launcher sources
- `src/commands/` — one TypeScript file per command
- `src/lib/` — shared code

## Install

    ./install.sh

Installs dependencies (`npm install`, skipped if already present) and symlinks every executable in `bin/` into `~/.bin`. Make sure `~/.bin` is on your PATH.

It is idempotent and never deletes anything: existing links are left alone, conflicting files are reported and untouched, and dead symlinks to removed tools are listed with a suggested `rm` command for you to run yourself.

If you run a launcher before installing dependencies, it tells you what to do.

## Adding a command

1. Create `src/commands/<name>.ts`.
2. Copy `bin/hello` to `bin/<name>` and change the last line to `run_tool <name> "$@"`.
3. `chmod +x bin/<name>`.

## Scripts

`npm run typecheck`, `npm run lint`, `npm run format`
