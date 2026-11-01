---
name: bash
description: Bash/shell scripting conventions for cli-tools launchers (bin/), shared logic (shell/common.sh) and install.sh. Use when creating or editing any shell script in this repo.
---

# Bash conventions

Reference implementations: `bin/hello` (launcher), `shell/common.sh` (sourced library), `install.sh` (installer).

## Executables vs. sourced files

- Executables start with `#!/usr/bin/env bash` and `set -euo pipefail`.
- Sourced files (`shell/common.sh`) have **no shebang** and no `set` options. They inherit them from the caller. Document what they expect from the caller in a header comment (e.g. `BIN_DIR`).

## Launchers (`bin/<name>`)

Launchers are thin and identical apart from the last line. Keep the symlink-resolving block, because launchers are run through symlinks in `~/.bin`:

```bash
SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
BIN_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"

# shellcheck source=../shell/common.sh
source "$BIN_DIR/../shell/common.sh"

run_tool <name> "$@"
```

Don't put real logic in launchers; put shared behaviour in `shell/common.sh` and real work in TypeScript.

## Style

- Quote every expansion (`"$var"`, `"$@"`); use `[[ ... ]]` for pattern tests and `[ ... ]` for simple file tests, as the existing scripts do.
- `local` for function variables. Private helpers are prefixed with `_` (`_err`, `_preflight`).
- Errors go to stderr. In `common.sh` use `_err`, which prefixes `cli-tools: `. Use `return 1` in helpers and `exit 1` at the top level of a launcher flow.
- Check for tools with `command -v x >/dev/null 2>&1`, and give the user an actionable message (what's missing and what to run).
- Add `# shellcheck source=...` directives above `source` lines.
- Use `printf` rather than `echo` for formatted output.

## Installer rules (`install.sh`)

- Idempotent: running it twice changes nothing the second time.
- **Never deletes anything.** Conflicts are reported and left untouched. Dead links are listed with a suggested `rm` command for the user to run.
- Output: section headers via `echo`, indented lines via `info`, warnings via `warn` (`  ! message`, to stderr).

## Portability

Target macOS (BSD userland, bash 3.2 may be `/bin/bash`, hence `#!/usr/bin/env bash`) and Linux. Avoid GNU-only flags (`readlink -f`, `sed -i` without a suffix, `date -d`) unless guarded. The existing symlink loop exists precisely to avoid `readlink -f`.

## Checking

No shellcheck config exists. If `shellcheck` is installed, run it on changed scripts, e.g. `shellcheck -x bin/* shell/common.sh install.sh`. Always test a launcher by running it, and test `install.sh` changes with a throwaway `HOME` (`HOME=$(mktemp -d) ./install.sh`) so your real `~/.bin` isn't touched.
