# aliaz

Notes for working in `src/lib/aliaz/`. Read before touching the tool.

`aliaz` manages shell aliases: a TOML file in, cached sourceable files out. Entry: `src/tools/aliaz.ts` (thin). User docs: `aliaz --help` ("Good to know"); `README.md` here is a short intro only.

- Config: `$XDG_CONFIG_HOME/aliaz/config.toml` (optional; `aliases_file`, `shells`; `config.ts`). Aliases file: `aliases.toml` next to it (`store.ts`). Generated files: `$XDG_STATE_HOME/aliaz/aliases.<shell>` (`generate.ts`).
- Data flow: `store.ts` parses the file into a `Spec` (plain aliases, expand rules, function rules); `expand.ts` `materialize()` scans directories and returns a `Model` (what is rendered, shown and wrong); `shells/render.ts` turns a `Model` into text per shell; `resolve.ts` classifies rows (active, shadowed, broken). Commands load via `context.ts` and mutate the `Spec` (never the `Model`), then call `persist.ts`.
- Rules: `expand` is a snapshot (one plain alias per entry, `aliaz sync` refreshes, `doctor` reports drift); `function` reads the directory at runtime and supports only `files_only`/`dirs_only` (no `strip_ext`/`match`). Rule `dir` values may not contain spaces, quotes or shell characters (`validateDir`): they are pasted into generated code unquoted so `~` expands.
- Invariants (keep): all quoting goes through `shells/quote.ts`; descriptions are single-line (they end up in comments); entry names from the disk must pass `isValidName` before they reach generated code; generated files start with `GENERATED_HEADER` and aliaz overwrites only files carrying it (anything else is refused, never replaced); nothing is ever deleted; the aliases file is written atomically; `remove` needs a TTY or `--yes`.
- Rewriting the TOML loses comments (documented in `--help`); `edit` is the comment-safe path.
- Tests: `test-harness.ts` wraps the shared `createHarness` (sandboxed `HOME`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, `aliases()`, `generated()`). `shells/shells.test.ts` runs quoting and function round-trips through real shells and skips a shell that is not installed (fish is skipped where missing, so fish output is only verified where it is installed).
