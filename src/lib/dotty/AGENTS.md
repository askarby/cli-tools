# dotty

Notes for working in `src/lib/dotty/`. Read before touching the tool.

`dotty` is a stow-style dotfiles manager (it never calls stow). Entry: `src/tools/dotty.ts` (thin). User docs: `dotty --help` ("Good to know") and the README.

- `config.ts` (`$XDG_CONFIG_HOME/dotty/config.toml`: `repo`, `target`, `ignore`), `paths.ts`, `packages.ts` (scan repo into packages/entries), `inspect.ts` (per-link state: linked/missing/conflict/broken/foreign; orphans), `planner.ts` (pure: what should happen), `apply.ts` (does it; removal via `safeUnlink`), `repo-ops.ts` (`adoptFile`: rename into repo, link back), `ui.ts` (state pills, action table), `commands/*` (one `register(program, deps)` per subcommand).
- `cli.ts` is a `CliSpec` wrapped around `src/lib/shared/cli.ts`. `Deps = { prompts, isInteractive }` is injected; `prompts.ts` re-exports `src/lib/shared/prompts.ts`. Tests use `test-harness.ts` (wraps the shared `createHarness`, adds `repo`, `repoFile`, `dotty`).
- Invariants (keep): one symlink per file, no directory folding; conflicts are never overwritten and block the whole `link`; nothing is deleted (`adopt`/`sync` only rename, and refuse on `EXDEV` rather than copy+delete; `drop` renames into `<repo>/.dotty-trash/`); links are removed only via `safeUnlink`; `adopt` is interactive-only (package first, then a basket of many paths; `candidates.ts` suggests common dotfiles); `sync`/`drop` need a TTY or `--yes`; `adopt` refuses `.ssh`, `.gnupg`, `.git`, `node_modules` (`NEVER_ADOPT` in `candidates.ts`); `sync` only scans folders at least two levels below the target.
- macOS: `/var` is `/private/var`. Compare paths through `normalize()` in `paths.ts`, never raw strings.
