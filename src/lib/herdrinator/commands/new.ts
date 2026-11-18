import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import { loadRc } from "../rc.ts";
import { emptyWorkspace } from "../templates.ts";
import { c, hint, say } from "../../shared/ui.ts";
import { listWorkspaceFiles } from "../workspace.ts";

export const register = (program: Command): void => {
  program
    .command("new")
    .alias("init")
    .description(
      "Create a new workspace file (comments only, explaining how to fill it in)",
    )
    .argument("<name>", "workspace file name, without extension")
    .action((name: string) => {
      if (!/^\w[\w.-]*$/.test(name))
        throw new CliError(
          `'${name}' is not a valid workspace name`,
          "Start with a letter, digit or '_'; then use letters, digits, '-', '_' and '.'",
        );
      const rc = loadRc();
      const existing = listWorkspaceFiles(rc).find(
        (entry) => entry.id === name,
      );
      if (existing)
        throw new CliError(
          `${existing.file} already exists`,
          `Edit it with: herdrinator edit ${name}`,
        );

      const file = join(rc.workspacesDir, `${name}.yml`);
      mkdirSync(rc.workspacesDir, { recursive: true });
      if (existsSync(file)) throw new CliError(`${file} already exists`);
      writeFileSync(file, emptyWorkspace(name));
      say(`✨ Created ${c.cyan(file)}`);
      hint(`Fill it in with: herdrinator edit ${name}`);
    });
};
