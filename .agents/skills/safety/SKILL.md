---
name: safety
description: Safety rules for code that deletes, overwrites, moves or executes things (clean-up tasks, `rm`, `rmSync`, `unlink`, shell commands, path building from user input or env vars). Use before writing or reviewing any such code in TypeScript or bash, so a tool can never wipe `/`, `$HOME` or anything outside the directory it owns.
---

# Safety for destructive code

Reference implementation: `src/lib/shared/safety.ts` (`safeRemove`) and its tests in `src/lib/shared/safety.test.ts`.

## Principles

1. **Prefer not deleting.** `install.sh` and launchers never delete (AGENTS.md). Tools should report and suggest where they can. Delete only when deletion is the feature.
2. **Scope is explicit.** Destructive code works on a target inside a directory the tool owns, named by the caller, never on a path assembled from unchecked input, env vars or `cwd`.
3. **Fail closed.** When anything is empty, missing, ambiguous or unexpected, stop and report. Never fall back to something broader.
4. **Show before doing.** Bulk or irreversible operations support `--dry-run` and require `--yes` (or an interactive confirmation) to act.

## The one way to delete in TypeScript

All deletion goes through `safeRemove(target, { root, dryRun?, maxEntries? })` from `src/lib/shared/safety.ts`. Direct `rmSync`, `rm`, `unlink`, `rmdir` or `fs.promises.rm` outside `safety.ts` and `test-utils.ts` is a review failure. `safeRemove` refuses (throws `SafetyError`, removes nothing) unless:

- the target is non-empty and exists;
- after `realpath` (so `..` and symlinked parents can't escape), the target is **strictly inside** `root`; the root itself is refused;
- `root` is real, deep enough (at least two path segments, so not `/` or `/usr`), is not `$HOME` or an ancestor of it, and contains the `.cli-tools-managed` marker file, so only directories a tool deliberately set up can be wiped;
- no path component is protected (`.git`, `.ssh`, `.gnupg`, `node_modules`), and the target is not the home directory or one of its parents or the marker;
- the entry count (counted without following symlinks) is within `maxEntries` (default 1000).

A symlink target is removed as a link; its destination is never followed or touched.

Do not weaken a check to make a test or feature work. Change the design (a different root, creating the marker when the tool creates the directory) instead.

### Using it in a command

```ts
const result = safeRemove(target, {
  root: workspacesDir,
  dryRun: values["dry-run"],
});
log(
  `${result.dryRun ? "Would remove" : "Removed"} ${result.entries.length} entries`,
);
```

- Create the managed directory (and its marker) in the same command that owns it, e.g. `setup`.
- Without `--yes` and without a TTY, refuse. With `--dry-run`, print the list and exit 0.
- Print what is removed. Never silently delete.

## Inputs, paths and env

- Validate names that become path segments: reject empty, `/`, `\`, `..`, a leading `-` or `.`, NUL. Join with `path.join` onto a known directory, then let `safeRemove` re-check.
- Treat env vars as untrusted: `XDG_CONFIG_HOME=""` or an unset `HOME` must never widen scope. Use `||` fallbacks as `paths.ts` does, and don't build a delete path from an env var alone.
- Don't derive a delete target from `process.cwd()` or a glob.

## Running commands

- Use `execFile` / `spawn` with an **args array**. Never interpolate input into a shell string.
- Known, intentional exceptions: `runner.ts` (`sh -c`) and `edit.ts` (`$EDITOR`) run commands the user wrote in their own config or environment. Don't copy that pattern for any value that isn't user-authored config.
- Never run with `sudo`, and never `chmod`/`chown` recursively.
- Respect `dryRun` where the module supports it (`herdr.ts`).

## Bash (`bin/`, `shell/`, `install.sh`)

- No deletion in launchers or the installer. Print a suggested command for the user to run instead.
- If a script must ever remove something: `set -euo pipefail`, and every variable in a path is `"${VAR:?}"`: `rm -rf -- "${DIR:?}/${NAME:?}"`. Never `rm -rf "$VAR/"`-style with an unchecked variable.
- Always `--` before user-supplied arguments to `rm`, `mv`, `cp`.
- Test installer changes with a throwaway home: `HOME=$(mktemp -d) ./install.sh`.

## Mandatory tests for destructive code

Every command or function that deletes must have tests, in a sandbox with a fake `HOME` (see the `testing` skill), proving it refuses or is harmless for each of:

| Case                                | Expectation                       |
| ----------------------------------- | --------------------------------- |
| target `""` / whitespace            | `SafetyError`                     |
| target `/` and `$HOME`              | `SafetyError`                     |
| the root itself                     | `SafetyError`                     |
| path outside the root               | `SafetyError`, file still there   |
| `..` traversal                      | `SafetyError`, file still there   |
| symlink to outside                  | link removed, destination intact  |
| path through a symlinked parent     | `SafetyError`, destination intact |
| root without marker / root `/`/home | `SafetyError`                     |
| protected name (`.git`, …)          | `SafetyError`                     |
| more entries than the limit         | `SafetyError`, nothing removed    |
| `--dry-run`                         | tree unchanged, list printed      |
| no `--yes`, no TTY                  | refuses, tree unchanged           |

`safety.test.ts` already covers `safeRemove` itself; a command's tests must prove the command passes the right root and honours `--dry-run` / `--yes`.

## Review checklist

- [ ] Every deletion goes through `safeRemove`, with a root the tool owns?
- [ ] Can any input, env var or empty string make the target broader than intended?
- [ ] `--dry-run` supported and truly side-effect free? Confirmation required otherwise?
- [ ] Anything built into a shell string from non-config input?
- [ ] Mandatory tests above present, and passing against a sandbox rather than the real machine?
- [ ] No check in `safety.ts` loosened in this change?
