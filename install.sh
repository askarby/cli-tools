#!/usr/bin/env bash
# Installs dependencies and symlinks every executable in bin/ into $HOME/.bin.
# Idempotent. NEVER deletes anything - dead symlinks are only reported.
set -euo pipefail

REPO_ROOT="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_BIN="$REPO_ROOT/bin"
DEST_BIN="$HOME/.bin"

info() { printf '  %s\n' "$*"; }
warn() { printf '  ! %s\n' "$*" >&2; }

# --- 1. Dependencies ---------------------------------------------------------
echo "Dependencies"
if [ -x "$REPO_ROOT/node_modules/.bin/tsx" ]; then
  info "already installed"
else
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    warn "node and npm are required (Node 22+, see .nvmrc). Install them and re-run."
    exit 1
  fi
  info "running npm install ..."
  (cd "$REPO_ROOT" && npm install)
fi

# --- 2. Link executables -----------------------------------------------------
echo "Links in $DEST_BIN"
mkdir -p "$DEST_BIN"

linked=0
for src in "$SRC_BIN"/*; do
  [ -e "$src" ] || continue
  name="$(basename "$src")"

  if [ ! -f "$src" ] || [ ! -x "$src" ]; then
    warn "skipping bin/$name: not an executable file (bin/ should only contain executables)"
    continue
  fi

  dest="$DEST_BIN/$name"
  if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then
    info "ok       $name (already linked)"
  elif [ -e "$dest" ] || [ -L "$dest" ]; then
    warn "conflict $name: $dest already exists and is not our link - left untouched"
  else
    ln -s "$src" "$dest"
    info "linked   $name"
    linked=$((linked + 1))
  fi
done

# --- 3. Suggest removals (never performed) -----------------------------------
dead=()
for link in "$DEST_BIN"/* "$DEST_BIN"/.[!.]*; do
  [ -L "$link" ] || continue
  [ -e "$link" ] && continue # target exists -> not dead
  target="$(readlink "$link")"
  case "$target" in "$SRC_BIN"/*) dead+=("$link") ;; esac
done

if [ "${#dead[@]}" -gt 0 ]; then
  echo "Dead symlinks (pointing to removed tools in this repo)"
  info "Nothing was removed. To clean up, you may run:"
  for link in "${dead[@]}"; do info "  rm \"$link\""; done
fi

# --- 4. PATH hint ------------------------------------------------------------
case ":$PATH:" in
  *":$DEST_BIN:"*) ;;
  *) echo "PATH"; warn "$DEST_BIN is not on your PATH. Add to your shell profile:"; info "  export PATH=\"\$HOME/.bin:\$PATH\"" ;;
esac

echo "Done."
