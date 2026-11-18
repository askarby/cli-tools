import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import { c, ok } from "../../shared/ui.ts";
import type { Deps } from "../cli.ts";
import { loadContext } from "../context.ts";
import { persist } from "../persist.ts";

export const register = (program: Command, deps: Deps): void => {
  program
    .command("remove")
    .description("Remove an alias or function from the aliases file")
    .argument("<name>", "alias or function name")
    .option("-y, --yes", "do not ask for confirmation")
    .action(async (name: string, opts: { yes?: boolean }) => {
      const { config, spec, model } = loadContext();
      const alias = spec.aliases.find((a) => a.name === name);
      const fn = spec.functions.find((f) => f.name === name);
      const expanded = model.aliases.find(
        (a) => a.name === name && a.kind === "expanded",
      );
      if (!alias && !fn) {
        throw new CliError(
          expanded
            ? `"${name}" comes from the rule for ${expanded.source}`
            : `No alias named "${name}"`,
          expanded
            ? "Remove the rule with `aliaz edit`"
            : "Run `aliaz list` to see them",
        );
      }
      if (!opts.yes) {
        if (!deps.isInteractive()) {
          throw new CliError("Pass --yes when not run interactively");
        }
        const what = alias?.command ?? fn?.command ?? "";
        if (!(await deps.prompts.confirm(`Remove ${name} (${what})?`))) {
          throw new CliError("Cancelled, nothing was changed");
        }
      }
      persist(config, {
        ...spec,
        aliases: spec.aliases.filter((a) => a !== alias),
        functions: spec.functions.filter((f) => f !== fn),
      });
      ok(`Removed ${c.bold(name)}`);
    });
};
