# herdrinator

Notes for working in `src/lib/herdrinator/`. Read before touching the tool.

`herdrinator` is a tmuxinator-style workspace launcher for [herdr](https://herdr.dev). Entry: `src/tools/herdrinator.ts` (thin).

- `cli.ts` is a `CliSpec` (name, description, examples, registrars) wrapped around `src/lib/shared/cli.ts`; `commands/*.ts` each export `register(program, deps)`. `Deps = { exec }` is injected (real `execHerdr` by default, `fake-herdr.ts` in tests).
- `herdr.ts` wraps the `herdr` CLI (JSON in/out, `dryRun` support); `runner.ts` turns a `WorkspaceSpec` into herdr calls; `workspace.ts` parses tmuxinator YAML; `rc.ts` parses `herdrinatorrc.toml`; colour/table helpers and `CliError` come from `src/lib/shared/` (`ui.ts`, `errors.ts`).
- Config lives in `$XDG_CONFIG_HOME/herdrinator/` (`herdrinatorrc.toml`, `workspaces/<name>.yml`).
- A workspace is "Running" when a live herdr workspace has the same label as the YAML `name`.
- To try commands without touching your real config or herdr state, use `start --dry-run` and a temporary `XDG_CONFIG_HOME`. Note `action newtab` targets the herdr workspace you are currently in.
- Tests never run the real `herdr`: inject `exec` (see `fake-herdr.ts`) through the shared `createHarness` (`h.cli(args, { exec })`, `h.stdout()`, `h.stderr()`); `rc.test.ts` uses `createEnvironment`; `launcher.e2e.test.ts` uses a stub binary on `PATH`.
