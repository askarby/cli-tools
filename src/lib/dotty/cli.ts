import type { Command } from "commander";
import { buildProgram as build, runCli, type CliSpec } from "../shared/cli.ts";
import { c } from "../shared/ui.ts";
import { register as adopt } from "./commands/adopt.ts";
import { register as doctor } from "./commands/doctor.ts";
import { register as drop } from "./commands/drop.ts";
import { register as init } from "./commands/init.ts";
import { register as link } from "./commands/link.ts";
import { register as list } from "./commands/list.ts";
import { register as sync } from "./commands/sync.ts";
import { register as unlink } from "./commands/unlink.ts";
import { clackPrompts, type Prompts } from "./prompts.ts";

const EXAMPLES = `
${c.bold("Examples:")}
  dotty init --repo ~/dotfiles         ${c.gray("create the config file")}
  dotty link --all                     ${c.gray("symlink every package into $HOME")}
  dotty link zsh git -n                ${c.gray("preview linking two packages")}
  dotty list                           ${c.gray("see what is linked")}
  dotty adopt                          ${c.gray("interactive: pick files, move into a package, link back")}
  dotty sync                           ${c.gray("pull live edits and new files into the repo")}
  dotty doctor                         ${c.gray("find broken or conflicting links")}
`;

const NOTES = `
${c.bold("Good to know:")}
  - One symlink per file (no stow-style directory folding); real directories are created
  - Conflicts are never overwritten: if any file is in the way, link changes nothing
  - Nothing is ever deleted: adopt/sync rename into the repo, drop moves to <repo>/.dotty-trash
  - adopt is always interactive; sync/drop need a TTY or --yes; adopt refuses .ssh, .gnupg, .git and node_modules
  - sync only scans folders at least two levels deep (e.g. ~/.config/nvim, never ~/.config)
  - link, unlink, adopt, sync and drop all support -n/--dry-run
`;

/** Everything interactive, injectable for tests. */
export interface Deps {
  prompts: Prompts;
  isInteractive: () => boolean;
}

export const defaultDeps: Deps = {
  prompts: clackPrompts,
  isInteractive: () => Boolean(process.stdin.isTTY && process.stdout.isTTY),
};

const spec: CliSpec<Deps> = {
  name: "dotty",
  description: "a stow-style dotfiles manager",
  helpText: EXAMPLES + NOTES,
  registrars: [init, link, unlink, list, adopt, sync, drop, doctor],
};

export const buildProgram = (deps: Deps = defaultDeps): Command =>
  build(spec, deps);

export const run = (argv: string[], deps: Deps = defaultDeps): Promise<void> =>
  runCli(spec, argv, deps);
