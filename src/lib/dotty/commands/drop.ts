import { existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import { c, hint, ok, say } from "../../shared/ui.ts";
import { applyActions } from "../apply.ts";
import type { Deps } from "../cli.ts";
import { loadConfig } from "../config.ts";
import { selectPackages } from "../packages.ts";
import { planUnlink } from "../planner.ts";
import { tildify } from "../paths.ts";
import { dryRunNote, plural, printActions } from "../ui.ts";

interface Opts {
  yes?: boolean;
  dryRun?: boolean;
}

export const register = (program: Command, deps: Deps): void => {
  program
    .command("drop")
    .description(
      "Unlink a package and move it out of the repo into .dotty-trash",
    )
    .argument("<package>", "package to drop")
    .option("-y, --yes", "don't ask for confirmation")
    .option("-n, --dry-run", "show what would happen, change nothing")
    .action(async (name: string, opts: Opts) => {
      const config = loadConfig();
      const [pkg] = selectPackages(config, [name], false);
      if (!pkg) throw new CliError(`Unknown package: ${name}`);
      const actions = planUnlink([pkg], config.target);
      const trash = join(
        config.repo,
        ".dotty-trash",
        `${pkg.name}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
      );
      printActions(actions);
      say(`\n📦 ${c.bold(pkg.name)} will move to ${tildify(trash)}\n`);
      if (opts.dryRun) return dryRunNote();
      if (!opts.yes) {
        if (!deps.isInteractive())
          throw new CliError(
            "Refusing to continue without --yes (not interactive)",
          );
        if (!(await deps.prompts.confirm(`Unlink and drop '${pkg.name}'?`))) {
          throw new CliError("Cancelled, nothing was changed");
        }
      }
      applyActions(actions, { dryRun: false, repo: config.repo });
      if (existsSync(trash))
        throw new CliError(`Trash entry already exists: ${tildify(trash)}`);
      mkdirSync(join(config.repo, ".dotty-trash"), { recursive: true });
      renameSync(pkg.dir, trash);
      ok(
        `Dropped ${c.bold(pkg.name)}: unlinked ${plural(actions.filter((a) => a.kind === "unlink").length, "link")}`,
      );
      hint(
        `Nothing was deleted. Restore by moving ${tildify(trash)} back, or delete it yourself.`,
      );
    });
};
