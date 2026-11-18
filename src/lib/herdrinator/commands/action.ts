import { basename } from "node:path";
import type { Command } from "commander";
import type { Deps } from "../cli.ts";
import { Herdr } from "../herdr.ts";
import { c, say } from "../../shared/ui.ts";

/** "claude ." -> "claude"; "/usr/bin/npm run dev" -> "npm". */
const nameFromCommand = (command: string): string =>
  basename(command.trim().split(/\s+/)[0] ?? command) || command;

export const register = (program: Command, deps: Deps): void => {
  const action = program
    .command("action")
    .description("🎬 Building blocks for scripts running inside herdr");

  action
    .command("workspace")
    .alias("w")
    .description("create (and focus) a named workspace")
    .argument("<name>", "workspace label")
    .option("--cwd <path>", "working directory", process.cwd())
    .action((name: string, options: { cwd: string }) => {
      const herdr = new Herdr(false, deps.exec);
      const created = herdr.createWorkspace(name, options.cwd);
      herdr.focusWorkspace(created.workspace.workspace_id);
      say(`📂 Workspace ${c.bold(name)} created`);
    });

  action
    .command("newtab")
    .aliases(["tab", "t"])
    .description("add a tab to the active workspace, running a command")
    .argument("<command>", "command to run in the tab")
    .option("--name <name>", "tab name (default: derived from the command)")
    .option("--cwd <path>", "working directory", process.cwd())
    .action((command: string, options: { name?: string; cwd: string }) => {
      const herdr = new Herdr(false, deps.exec);
      const name = options.name ?? nameFromCommand(command);
      const created = herdr.createTab(
        herdr.currentWorkspaceId(),
        name,
        options.cwd,
      );
      herdr.run(created.root_pane.pane_id, command);
      say(`🗂️  Tab ${c.bold(name)} running ${c.cyan(command)}`);
    });
};
