---
name: architecture
description: How the cli-tools repository is structured and how a command runs from the shell to TypeScript. Use when adding, renaming or removing a command, touching install.sh, or deciding where new code belongs.
---

# cli-tools architecture

## Layout

```
bin/<name>              bash launcher, one per command (executables only)
shell/common.sh         shared launcher logic, sourced by every launcher
src/commands/<name>.ts  TypeScript entrypoint, one per command
src/lib/                shared TypeScript code (e.g. log.ts: log, fail)
install.sh              installs deps, symlinks bin/* into ~/.bin
```

## How a command runs

1. The user runs `<name>` (a symlink in `~/.bin` to `bin/<name>`).
2. `bin/<name>` resolves its symlink to find the real `BIN_DIR`, sources `shell/common.sh`, and calls `run_tool <name> "$@"`.
3. `run_tool` runs `_preflight` (node on PATH, `node_modules/.bin/tsx` present) and then `exec`s `tsx src/commands/<name>.ts "$@"`.

The name passed to `run_tool` must match the file name in `src/commands/`.

## Adding a command

1. Create `src/commands/<name>.ts` (see the `typescript` skill).
2. Copy `bin/hello` to `bin/<name>` and change the last line to `run_tool <name> "$@"`.
3. `chmod +x bin/<name>`.
4. Run `npm run typecheck && npm run lint`.
5. Run `./install.sh` to link it into `~/.bin`, then try the command.

Put code used by more than one command in `src/lib/`, not in a command file. Put launcher logic shared by all commands in `shell/common.sh`, not in individual launchers.

## Design decisions (keep these)

- **No build step.** Commands run straight from source through repo-local `tsx`. Don't add a compile/dist step.
- **No runtime dependencies.** Prefer Node built-ins.
- **Bash is only a launcher.** Real logic belongs in TypeScript; launchers just locate the repo and hand off.
- **`install.sh` is idempotent and non-destructive.** Existing links are left alone, conflicts are reported, dead links are listed with a suggested `rm` for the user to run.
- **`bin/` holds only executables.** `install.sh` warns about anything else.

## Known quirks

- Node versions differ: `.tool-versions` 24.11.1, `.nvmrc` 22, `engines` `>=22`.
- `tsconfig.json` includes only `src/`, so typecheck doesn't cover config files.
