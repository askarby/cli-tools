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
src/lib/                per-tool code in src/lib/<tool>/; src/lib/shared/ is cross-tool (log.ts: log, fail; safety.ts: safeRemove; test-utils.ts)
src/**/*.test.ts        Vitest tests, next to the code they test (see the `testing` skill)
install.sh              installs deps, symlinks bin/* into ~/.bin
```

## How a command runs

1. The user runs `<name>` (a symlink in `~/.bin` to `bin/<name>`).
2. `bin/<name>` resolves its own symlink, sources `shell/_common.sh`, and calls `run_tool <name> "$@"`.
3. `run_tool` runs `_preflight` (node on PATH, `node_modules/.bin/tsx` present) and then `exec`s `tsx src/tools/<name>.ts "$@"`.

The name passed to `run_tool` must match the file name in `src/tools/`.

## Adding a command

1. Create `src/tools/<name>.ts` (see the `typescript` skill).
2. Copy `bin/hello` to `bin/<name>` (add `require_command <tool> <hint>` before `run_tool` if the command needs an external tool) and change the last line to `run_tool <name> "$@"`.
3. `chmod +x bin/<name>`.
4. Add tests next to the lib code (`testing` skill).
5. Run `npm run typecheck && npm run lint && npm test`.
6. Run `./install.sh` to link it into `~/.bin`, then try the command.

Put code used by more than one command in `src/lib/shared/`, not in a tool file. Put launcher logic shared by all commands in `shell/_common.sh`, not in individual launchers.

## Design decisions (keep these)

- **No build step.** Commands run straight from source through repo-local `tsx`. Don't add a compile/dist step.
- **Few runtime dependencies.** Prefer Node built-ins. Approved exceptions, all used by `herdrinator`: `commander` (CLI parsing), `yaml` and `smol-toml` (config files). Ask before adding more.
- **Bash is only a launcher.** Real logic belongs in TypeScript; launchers just locate the repo and hand off.
- **`install.sh` is idempotent and non-destructive.** Existing links are left alone, conflicts are reported, dead links are listed with a suggested `rm` for the user to run.
- **`bin/` holds only executables.** `install.sh` warns about anything else.

## Known quirks

- Node versions differ: `.tool-versions` 24.11.1, `.nvmrc` 22, `engines` `>=22`.
- `tsconfig.json` includes only `src/`, so typecheck doesn't cover config files.

## herdrinator

`herdrinator` is a tmuxinator-style workspace launcher for [herdr](https://herdr.dev). Entry: `src/tools/herdrinator.ts` (thin); everything else is in `src/lib/herdrinator/`:

- `cli.ts` builds the Commander program; `commands/*.ts` each export `register(program)`.
- `herdr.ts` wraps the `herdr` CLI (JSON in/out, `dryRun` support); `runner.ts` turns a `WorkspaceSpec` into herdr calls; `workspace.ts` parses tmuxinator YAML; `rc.ts` parses `herdrinatorrc.toml`; `ui.ts` holds colour/emoji/table helpers.
- Config lives in `$XDG_CONFIG_HOME/herdrinator/` (`herdrinatorrc.toml`, `workspaces/<name>.yml`).
- A workspace is "Running" when a live herdr workspace has the same label as the YAML `name`.
- To try commands without touching your real config or herdr state, use `start --dry-run` and a temporary `XDG_CONFIG_HOME`. Note `action newtab` targets the herdr workspace you are currently in.
