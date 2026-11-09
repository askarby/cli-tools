import type { Command } from "commander";
import type { Deps } from "../cli.ts";
import { Herdr } from "../herdr.ts";
import { loadRc } from "../rc.ts";
import { c, hint, say, table } from "../ui.ts";
import { listWorkspaceFiles, loadWorkspace } from "../workspace.ts";

const STATUS = {
  running: `🟢 ${c.green("RUNNING")}`,
  closed: `⚪ ${c.gray("CLOSED")}`,
  unmanaged: `🟡 ${c.yellow("UNMANAGED")}`,
  invalid: `🔴 ${c.red("INVALID")}`,
};

export const register = (program: Command, deps: Deps): void => {
  program
    .command("list")
    .alias("ls")
    .description("📋 List workspaces and whether they are running in herdr")
    .action(() => {
      const rc = loadRc();
      const live = new Map(
        new Herdr(false, deps.exec)
          .listWorkspaces()
          .map((workspace) => [workspace.label, workspace]),
      );
      const known = new Set<string>();
      const rows: string[][] = [];

      for (const { id, file } of listWorkspaceFiles(rc)) {
        try {
          const spec = loadWorkspace(file);
          known.add(spec.name);
          const status = live.has(spec.name) ? STATUS.running : STATUS.closed;
          rows.push([
            status,
            c.bold(id),
            `${spec.windows.length} tabs`,
            c.gray(spec.root),
          ]);
        } catch {
          rows.push([STATUS.invalid, c.bold(id), "", c.gray(file)]);
        }
      }
      for (const [label, workspace] of live) {
        if (!known.has(label)) {
          rows.push([
            STATUS.unmanaged,
            c.bold(label),
            `${workspace.tab_count} tabs`,
            c.gray("(no configuration file)"),
          ]);
        }
      }

      if (rows.length === 0) {
        say("📭 No workspaces found.");
        hint("Create one with: herdrinator new <name>");
        return;
      }
      table(["STATUS", "NAME", "TABS", "ROOT"], rows);
    });
};
