# cli-tools

TypeScript CLI tools for my development machines. Commands run directly with [tsx](https://tsx.is) — no build step.

## Layout

- `bin/` — one executable bash launcher per command (only executables live here)
- `shell/_common.sh` — shared bash library every launcher sources (not runnable on its own)
- `src/tools/` — one TypeScript entrypoint per tool
- `src/lib/` — shared code

## Install

    ./install.sh

Installs dependencies (`npm install`, skipped if already present) and symlinks every executable in `bin/` into `~/.bin`. Make sure `~/.bin` is on your PATH.

It is idempotent and never deletes anything: existing links are left alone, conflicting files are reported and untouched, and dead symlinks to removed tools are listed with a suggested `rm` command for you to run yourself.

If you run a launcher before installing dependencies, it tells you what to do.

## Adding a command

1. Create `src/tools/<name>.ts`.
2. Copy `bin/hello` to `bin/<name>` and change the last line to `run_tool <name> "$@"`.
3. `chmod +x bin/<name>`.

## Testing

    npm test            # vitest run
    npm run test:watch

Tests live next to the code as `*.test.ts` and run in temp sandboxes, never against your real config.

## herdrinator

tmuxinator-style workspaces for [herdr](https://herdr.dev). Workspace files use the tmuxinator YAML format (windows become tabs, panes become splits).

    herdrinator setup          # create ~/.config/herdrinator/herdrinatorrc.toml + example bob.yml
    herdrinator new bob        # new commented workspace file (alias: init)
    herdrinator start bob      # build the workspace (focuses it if already running)
    herdrinator list           # RUNNING / CLOSED / UNMANAGED overview
    herdrinator stop bob       # close it
    herdrinator doctor         # sanity-check herdr, config and workspace files
    herdrinator action w "CLI Tools"                    # script helpers: create a workspace
    herdrinator action t "claude ." --name "Claude"     # ... and add a tab to the active one

Run `herdrinator` without arguments for the full usage guide. `start --dry-run` prints the herdr calls without running them. Supported YAML keys: `name`, `root`, `windows` (with `layout`, `root`, `pre`, `panes`), `pre`, `pre_window`, `on_project_start`, `startup_window`; anything else produces a warning. A workspace counts as running when a herdr workspace has the same label as its `name`.

## Scripts

`npm run typecheck`, `npm run lint`, `npm run format`
