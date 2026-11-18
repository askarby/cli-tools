import type { Command } from "commander";
import type { Deps } from "../cli.ts";
import { Herdr } from "../herdr.ts";
import { loadRc } from "../rc.ts";
import { buildWorkspace } from "../runner.ts";
import { c, hint, say, warn } from "../../shared/ui.ts";
import { findWorkspaceFile, loadWorkspace } from "../workspace.ts";

interface Options {
  focus: boolean;
  dryRun: boolean;
  force: boolean;
}

export const register = (program: Command, deps: Deps): void => {
  program
    .command("start")
    .description("Start a workspace from its configuration file")
    .argument("<name>", "workspace file name, without extension")
    .option("--no-focus", "do not focus the workspace once built")
    .option("--dry-run", "print the herdr calls without running anything")
    .option("--force", "close an already running workspace and rebuild it")
    .action((name: string, options: Options) => {
      const rc = loadRc();
      const spec = loadWorkspace(findWorkspaceFile(rc, name));
      for (const message of spec.warnings) warn(`${spec.id}: ${message}`);

      const herdr = new Herdr(options.dryRun, deps.exec);
      const running = herdr
        .listWorkspaces()
        .find((workspace) => workspace.label === spec.name);
      if (running && !options.force) {
        herdr.focusWorkspace(running.workspace_id);
        say(
          `📂 ${c.bold(spec.name)} is already ${c.green("RUNNING")} - focused it`,
        );
        hint(`Rebuild it with: herdrinator start ${name} --force`);
        return;
      }
      if (running) herdr.closeWorkspace(running.workspace_id);

      say(
        `🚀 Starting ${c.bold(spec.name)} ${c.gray(`(${spec.windows.length} tabs)`)}`,
      );
      buildWorkspace(herdr, spec, options.focus && rc.focus);
      say(
        options.dryRun
          ? "📝 Dry run - nothing was changed"
          : `✅ ${c.bold(spec.name)} is ${c.green("RUNNING")}`,
      );
    });
};
