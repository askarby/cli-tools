import { spawnSync } from "node:child_process";
import type { Command } from "commander";
import { buildProgram as build, runCli, type CliSpec } from "../shared/cli.ts";
import { clackPrompts, type Prompts } from "../shared/prompts.ts";
import { c } from "../shared/ui.ts";
import { register as add } from "./commands/add.ts";
import { register as doctor } from "./commands/doctor.ts";
import { register as generate } from "./commands/generate.ts";
import { register as init } from "./commands/init.ts";
import { register as edit } from "./commands/edit.ts";
import { register as list } from "./commands/list.ts";
import { register as remove } from "./commands/remove.ts";
import { register as search } from "./commands/search.ts";
import { register as sync } from "./commands/sync.ts";

const HELP = `
${c.bold("Examples:")}
  aliaz init                    ${c.gray("create the config and an empty aliases file")}
  aliaz add                     ${c.gray("add an alias interactively")}
  aliaz list                    ${c.gray("show all aliases and their state")}
  aliaz generate zsh            ${c.gray("write the sourceable file for zsh")}

${c.bold("Good to know:")}
  - Aliases live in $XDG_CONFIG_HOME/aliaz/aliases.toml, grouped as [group.name]
  - config.toml (same folder) is optional: aliases_file and shells, with defaults
  - Shells source a generated file in $XDG_STATE_HOME/aliaz/; aliaz never runs at shell start, so startup stays fast
  - [[group.expand]] makes one alias per directory entry (a snapshot: refresh with aliaz sync)
  - [[group.function]] makes "name <entry>" with tab completion that reads the directory live
  - add and remove rewrite the TOML file, so comments are not kept; aliaz edit keeps them
  - Rule directories may not contain spaces, quotes or shell characters
`;

/** Everything interactive, injectable for tests. */
export interface Deps {
  prompts: Prompts;
  isInteractive: () => boolean;
  /** Opens `file` in `editor` and waits (a shell command line, e.g. `code -w`). */
  openEditor: (editor: string, file: string) => void;
}

export const defaultDeps: Deps = {
  prompts: clackPrompts,
  isInteractive: () => Boolean(process.stdin.isTTY && process.stdout.isTTY),
  openEditor: (editor, file) => {
    // The editor is the user's own $EDITOR line (may carry flags); the file is passed as "$1".
    spawnSync("sh", ["-c", `${editor} "$1"`, "aliaz-edit", file], {
      stdio: "inherit",
    });
  },
};

const spec: CliSpec<Deps> = {
  name: "aliaz",
  description: "Manage, search and generate shell aliases",
  helpText: HELP,
  registrars: [init, add, list, search, remove, edit, sync, generate, doctor],
};

export const buildProgram = (deps: Deps = defaultDeps): Command =>
  build(spec, deps);

export const run = (argv: string[], deps: Deps = defaultDeps): Promise<void> =>
  runCli(spec, argv, deps);
