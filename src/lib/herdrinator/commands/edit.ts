import { spawnSync } from "node:child_process";
import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import { loadRc } from "../rc.ts";
import { findWorkspaceFile } from "../workspace.ts";

export const register = (program: Command): void => {
  program
    .command("edit")
    .description("📝 Open a workspace file in your editor")
    .argument("<name>", "workspace file name, without extension")
    .action((name: string) => {
      const rc = loadRc();
      const file = findWorkspaceFile(rc, name);
      const editor =
        rc.editor || process.env["VISUAL"] || process.env["EDITOR"];
      if (!editor)
        throw new CliError(
          "No editor configured",
          "Set `editor` in herdrinatorrc.toml or export $EDITOR",
        );
      // The path travels in an env var, so the shell never parses it.
      spawnSync(`${editor} "$HERDRINATOR_FILE"`, {
        shell: true,
        stdio: "inherit",
        env: { ...process.env, HERDRINATOR_FILE: file },
      });
    });
};
