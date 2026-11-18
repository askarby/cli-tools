import type { Command } from "commander";
import type { Deps } from "../cli.ts";
import { CliError } from "../../shared/errors.ts";
import { Herdr } from "../herdr.ts";
import { loadRc } from "../rc.ts";
import { c, say } from "../../shared/ui.ts";
import { listWorkspaceFiles, loadWorkspace } from "../workspace.ts";

export const register = (program: Command, deps: Deps): void => {
  program
    .command("stop")
    .description("Close a running workspace")
    .argument("<name>", "workspace file name (or the herdr workspace label)")
    .action((name: string) => {
      const entry = listWorkspaceFiles(loadRc()).find(
        (candidate) => candidate.id === name,
      );
      const label = entry ? loadWorkspace(entry.file).name : name;

      const herdr = new Herdr(false, deps.exec);
      const running = herdr
        .listWorkspaces()
        .find((workspace) => workspace.label === label);
      if (!running)
        throw new CliError(
          `'${label}' is not running`,
          "See what is: herdrinator list",
        );
      herdr.closeWorkspace(running.workspace_id);
      say(`🛑 Closed ${c.bold(label)}`);
    });
};
