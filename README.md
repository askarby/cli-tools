# cli-tools

TypeScript CLI tools for my development machines. Commands run directly with [tsx](https://tsx.is) — no build step.

## Layout

- `bin/` — one executable bash launcher per command (only executables live here)
- `shell/_common.sh` — shared bash library every launcher sources (not runnable on its own)
- `src/tools/` — one TypeScript entrypoint per tool
- `src/lib/` — per-tool code, and `src/lib/shared/` for code several tools use
- `scripts/` — repo-dev scripts (`npm run new-tool`)

## Install

    ./install.sh

Installs dependencies (`npm install`, skipped if already present) and symlinks every executable in `bin/` into `~/.bin`. Make sure `~/.bin` is on your PATH.

It is idempotent and never deletes anything: existing links are left alone, conflicting files are reported and untouched, and dead symlinks to removed tools are listed with a suggested `rm` command for you to run yourself.

If you run a launcher before installing dependencies, it tells you what to do.

## Adding a command

    npm run new-tool -- <name>      # scaffold launcher, entry, lib skeleton, test, CI job, README stub

then follow `.agents/skills/new-tool/SKILL.md`. By hand: create `src/tools/<name>.ts`, copy `bin/hello` to `bin/<name>` (last line `run_tool <name> "$@"`), `chmod +x bin/<name>`.

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

## dotty

A stow-style dotfiles manager (no stow involved). The repo is a set of _packages_: `<repo>/<package>/<path as seen from $HOME>`, e.g. `zsh/.zshrc` or `nvim/.config/nvim/init.lua`.

    dotty init --repo ~/dotfiles    # write ~/.config/dotty/config.toml
    dotty link --all                # symlink every package (or: dotty link zsh git)
    dotty unlink zsh                # remove a package's links; repo files stay
    dotty list                      # LINKED / PARTIAL / UNLINKED / BROKEN overview (alias: ls)
    dotty adopt                     # interactive: pick files (any folder), link back
    dotty sync                      # pull live edits and new files into the repo
    dotty drop zsh                  # unlink, then move the package to <repo>/.dotty-trash
    dotty doctor                    # find broken, orphaned or conflicting links

Config (`$XDG_CONFIG_HOME/dotty/config.toml`): `repo` (local path, required), `target` (default `$HOME`), `ignore` (name globs). Differences from stow: no directory "folding" (real directories, one link per file), conflicts are never overwritten, and nothing is ever deleted (`drop` moves to `.dotty-trash`; links are removed with `safeUnlink`). `link`/`unlink`/`adopt`/`sync`/`drop` all support `--dry-run`; `adopt` is always interactive; `sync`/`drop` need a TTY or `--yes`.

## aliaz

Shell alias manager: one TOML file with groups and descriptions, discoverable with `list` and `search`, and turned into a sourceable file for sh, bash, zsh and fish.

| Command                         | What it does                                                          |
| ------------------------------- | --------------------------------------------------------------------- |
| `aliaz init`                    | create `config.toml` and an empty `aliases.toml`                      |
| `aliaz add`                     | add an alias, a directory rule or a function (interactive or flags)   |
| `aliaz list` / `search <words>` | show aliases with state; find by name, description or command         |
| `aliaz remove <name>`           | remove an alias or function (`--yes` when not on a TTY)               |
| `aliaz sync`                    | rescan rule directories and regenerate the files (`--dry-run`)        |
| `aliaz generate [shell]`        | write (or `--stdout` print) the sourceable file                       |
| `aliaz edit` / `doctor`         | edit the file in `$EDITOR`; check config, aliases and generated files |

Config (`$XDG_CONFIG_HOME/aliaz/config.toml`, optional): `aliases_file` (default `<config dir>/aliases.toml`) and `shells` (default zsh, bash, fish). Source the generated file from your shell rc, e.g. `source ~/.local/state/aliaz/aliases.zsh`; aliaz never runs at shell start, so startup stays fast.

`aliases.toml` has plain aliases (`[git.gs]` with `command`, `description`), directory rules (`[[mux.expand]]`: one alias per entry, refreshed by `aliaz sync`) and functions (`[[code.function]]`: `proj <entry>` with tab completion, always current). Commands that change the file rewrite it, so comments are not kept; use `aliaz edit` to keep them.

## Scripts

`npm run typecheck`, `npm run lint`, `npm run format`
