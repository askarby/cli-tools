import type { Command } from "commander";
import { buildProgram as build, runCli, type CliSpec } from "../shared/cli.ts";
import { execHerdr, type Exec } from "./herdr.ts";
import { c } from "../shared/ui.ts";
import { register as action } from "./commands/action.ts";
import { register as doctor } from "./commands/doctor.ts";
import { register as edit } from "./commands/edit.ts";
import { register as list } from "./commands/list.ts";
import { register as newWorkspace } from "./commands/new.ts";
import { register as setup } from "./commands/setup.ts";
import { register as start } from "./commands/start.ts";
import { register as stop } from "./commands/stop.ts";

const EXAMPLES = `
${c.bold("Examples:")}
  herdrinator setup                           ${c.gray("create the config file and an example workspace")}
  herdrinator new bob                         ${c.gray("create bob.yml")}
  herdrinator start bob                       ${c.gray("build (or focus) the 'bob' workspace")}
  herdrinator list                            ${c.gray("show which workspaces are running")}
  herdrinator action w "CLI Tools"            ${c.gray("script: create a workspace")}
  herdrinator action t "claude ." --name Claude  ${c.gray("script: add a tab to the active workspace")}
`;

const REGISTRARS: ((program: Command, deps: Deps) => void)[] = [
  start,
  newWorkspace,
  setup,
  list,
  edit,
  stop,
  doctor,
  action,
];

/** Everything with side effects outside the filesystem, injectable for tests. */
export interface Deps {
  /** Runs `herdr <args>`; defaults to the real binary. */
  exec: Exec;
}

export const defaultDeps: Deps = { exec: execHerdr };

const spec: CliSpec<Deps> = {
  name: "herdrinator",
  description: "tmuxinator-style workspaces for herdr",
  helpText: EXAMPLES,
  registrars: REGISTRARS,
};

export const buildProgram = (deps: Deps = defaultDeps): Command =>
  build(spec, deps);

export const run = (argv: string[], deps: Deps = defaultDeps): Promise<void> =>
  runCli(spec, argv, deps);
