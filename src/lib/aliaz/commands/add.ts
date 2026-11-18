import type { Command } from "commander";
import { c, hint, ok, warn } from "../../shared/ui.ts";
import type { Deps } from "../cli.ts";
import { loadContext } from "../context.ts";
import { DEFAULT_GROUP } from "../model.ts";
import { persist } from "../persist.ts";
import { which } from "../resolve.ts";
import {
  addAlias,
  addExpand,
  addFunction,
  chooseKind,
  type AddOptions,
} from "./add-flow.ts";

export const register = (program: Command, deps: Deps): void => {
  program
    .command("add")
    .description(
      "Add an alias, a directory rule or a function (interactive unless given flags)",
    )
    .option("-n, --name <name>", "alias or function name")
    .option(
      "-c, --command <command>",
      "command to run ({entry} and {dir} in rules)",
    )
    .option("-d, --description <text>", "what it is for")
    .option("-g, --group <group>", `group (default: ${DEFAULT_GROUP})`)
    .option("--dir <path>", "one alias per entry of this directory (a rule)")
    .option(
      "--function",
      "make a runtime function instead of aliases (needs --dir)",
    )
    .option("--files-only", "rules: only files")
    .option("--dirs-only", "rules: only directories")
    .option("--strip-ext", "expand rules: drop the file extension from names")
    .option("--match <glob>", "expand rules: only entries matching * and ?")
    .option("--name-prefix <text>", "expand rules: prefix for every alias name")
    .action(async (opts: AddOptions) => {
      const { config, spec } = loadContext();
      const kind = await chooseKind(opts, deps);
      const add = { alias: addAlias, expand: addExpand, function: addFunction }[
        kind
      ];
      const added = await add(spec, opts, deps);
      persist(config, added.spec);
      ok(`Added ${c.bold(added.summary)}`);
      if (added.name && which(added.name)) {
        warn(`'${added.name}' hides an existing command on PATH`);
      }
      hint("Open a new shell (or re-source the generated file) to use it");
    });
};
