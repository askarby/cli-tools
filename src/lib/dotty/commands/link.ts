import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import { c, ok, say } from "../../shared/ui.ts";
import { applyActions } from "../apply.ts";
import { loadConfig } from "../config.ts";
import { selectPackages } from "../packages.ts";
import { planLink } from "../planner.ts";
import { dryRunNote, plural, printActions } from "../ui.ts";

interface Opts {
  all?: boolean;
  dryRun?: boolean;
  target?: string;
}

export const register = (program: Command): void => {
  program
    .command("link")
    .description("Symlink packages from the repo into the target")
    .argument("[packages...]", "packages to link")
    .option("-a, --all", "link every package")
    .option("-n, --dry-run", "show what would happen, change nothing")
    .option("-t, --target <dir>", "override the link target for this run")
    .action((names: string[], opts: Opts) => {
      const config = loadConfig(
        opts.target !== undefined ? { target: opts.target } : {},
      );
      const pkgs = selectPackages(config, names, opts.all);
      const actions = planLink(pkgs, config.target);
      if (actions.length === 0)
        return say("Nothing to link: packages are empty");
      printActions(actions);
      say();
      const conflicts = actions.filter((a) => a.kind === "conflict");
      if (conflicts.length > 0) {
        throw new CliError(
          `${plural(conflicts.length, "conflict")}: nothing was linked`,
          "Move the files away, or bring them into the repo with `dotty adopt` / `dotty sync`",
        );
      }
      const links = actions.filter((a) => a.kind === "link");
      applyActions(actions, {
        dryRun: opts.dryRun ?? false,
        repo: config.repo,
      });
      if (opts.dryRun) return dryRunNote();
      ok(
        links.length === 0
          ? c.gray("Already up to date")
          : `Linked ${plural(links.length, "file")} from ${plural(pkgs.length, "package")}`,
      );
    });
};
