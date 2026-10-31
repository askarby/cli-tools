# Shared logic for all bin scripts. Sourced (not executed) by each `bin/<tool>` file.
# Expects BIN_DIR to be set by the caller (the real, symlink-resolved bin directory).

REPO_ROOT="$(cd -P "$BIN_DIR/.." && pwd)"
TSX="$REPO_ROOT/node_modules/.bin/tsx"

_err() { printf 'cli-tools: %s\n' "$*" >&2; }

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
# Runs src/commands/<name>.ts through the repo-local tsx.
run_tool() {
  local name="$1"
  shift
  local entry="$REPO_ROOT/src/commands/$name.ts"

  _preflight || exit 1

  if [ ! -f "$entry" ]; then
    _err "command source not found: $entry"
    exit 1
  fi

  exec "$TSX" "$entry" "$@"
}
