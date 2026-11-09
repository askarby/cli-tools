# Shared logic for all bin scripts. A library: sourced (never executed) by each `bin/<tool>` launcher.
# Needs nothing from the caller; it locates the repo from its own path.

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  printf '_common.sh: this file is a library and must be sourced, not executed.\n' >&2
  exit 1
fi

REPO_ROOT="$(cd -P "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TSX="$REPO_ROOT/node_modules/.bin/tsx"

_err() { printf 'cli-tools: %s\n' "$*" >&2; }

# Detect a help request from the launcher's arguments. A file that is sourced without arguments
# sees the sourcing script's positional parameters, so launchers need no extra wiring.
# Help must work without a tool's prerequisites (e.g. in CI), so require_command skips on it.
_HELP_REQUESTED=0
for _arg in "$@"; do
  case "$_arg" in
    --) break ;;
    -h | --help | '-?')
      _HELP_REQUESTED=1
      break
      ;;
  esac
done
unset _arg

# Usage: require_command <command> [hint]
# Fails with an actionable message when <command> is not on PATH.
# Does nothing when help was requested, so `--help` works without the prerequisite installed.
require_command() {
  local cmd="$1" hint="${2:-}"
  [ "$_HELP_REQUESTED" = 1 ] && return 0
  if ! command -v "$cmd" >/dev/null 2>&1; then
    _err "'$cmd' was not found on your PATH."
    [ -n "$hint" ] && _err "$hint"
    exit 1
  fi
}

# Verifies prerequisites, printing helpful guidance on failure.
_preflight() {
  if ! command -v node >/dev/null 2>&1; then
    _err "Node.js was not found on your PATH."
    _err "Install Node.js 22 or newer (see .nvmrc), then try again."
    return 1
  fi

  if [ ! -x "$TSX" ]; then
    _err "dependencies are not installed, so tools cannot run yet."
    _err "Install them once from the repo root:"
    _err "    cd \"$REPO_ROOT\" && npm install"
    _err "(pnpm or yarn work too - any package manager that populates node_modules)"
    return 1
  fi
}

# Usage: run_tool <name> [args...]
# Runs src/tools/<name>.ts through the repo-local tsx.
run_tool() {
  local name="$1"
  shift
  local entry="$REPO_ROOT/src/tools/$name.ts"

  _preflight || exit 1

  if [ ! -f "$entry" ]; then
    _err "command source not found: $entry"
    exit 1
  fi

  exec "$TSX" "$entry" "$@"
}
