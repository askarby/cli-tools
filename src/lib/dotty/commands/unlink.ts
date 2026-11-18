import type { Command } from "commander";
import { c, ok, say } from "../../shared/ui.ts";
import { applyActions } from "../apply.ts";
import { loadConfig } from "../config.ts";
import { selectPackages } from "../packages.ts";
import { planUnlink } from "../planner.ts";
import { dryRunNote, plural, printActions } from "../ui.ts";

interface Opts {
  all?: boolean;
  dryRun?: boolean;
  target?: string;
}

export const register = (program: Command): void => {
  program
    .command("unlink")
    .description("🧹 Remove the symlinks of packages (repo files stay put)")
    .argument("[packages...]", "packages to unlink")
    .option("-a, --all", "unlink every package")
    .option("-n, --dry-run", "show what would happen, change nothing")
    .option("-t, --target <dir>", "override the link target for this run")
    .action((names: string[], opts: Opts) => {
      const config = loadConfig(
        opts.target !== undefined ? { target: opts.target } : {},
      );
      const pkgs = selectPackages(config, names, opts.all);
      const actions = planUnlink(pkgs, config.target);
      if (actions.length === 0)
        return say("Nothing to unlink: packages are empty");
      printActions(actions);
      say();
      const removals = actions.filter((a) => a.kind === "unlink");
      applyActions(actions, {
        dryRun: opts.dryRun ?? false,
        repo: config.repo,
      });
      if (opts.dryRun) return dryRunNote();
      ok(
        removals.length === 0
          ? c.gray("Nothing was linked")
          : `Removed ${plural(removals.length, "link")}`,
      );
    });
};
