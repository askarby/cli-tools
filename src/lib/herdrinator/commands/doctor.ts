import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { Command } from "commander";
import { Herdr } from "../herdr.ts";
import { rcPath } from "../paths.ts";
import { loadRc } from "../rc.ts";
import { c, say } from "../ui.ts";
import { listWorkspaceFiles, loadWorkspace } from "../workspace.ts";

type Check = [ok: boolean | "warn", message: string];

const attempt = (fn: () => string): Check => {
  try {
    return [true, fn()];
  } catch (error) {
    return [false, (error as Error).message];
  }
};

export const register = (program: Command): void => {
  program
    .command("doctor")
    .description("🩺 Check herdr, configuration and workspace files")
    .action(() => {
      const checks: Check[] = [];
      checks.push(
        attempt(() =>
          execFileSync("herdr", ["--version"], { encoding: "utf8" }).trim(),
        ),
      );
      checks.push(
        attempt(
          () =>
            `herdr server reachable (${new Herdr().listWorkspaces().length} workspaces)`,
        ),
      );
      checks.push(
        existsSync(rcPath())
          ? [true, `config: ${rcPath()}`]
          : ["warn", `no ${rcPath()} (using defaults; run herdrinator setup)`],
      );

      try {
        const rc = loadRc();
        checks.push(
          existsSync(rc.workspacesDir)
            ? [true, `workspaces dir: ${rc.workspacesDir}`]
            : ["warn", `workspaces dir missing: ${rc.workspacesDir}`],
        );
        for (const { id, file } of listWorkspaceFiles(rc)) {
          checks.push(
            attempt(() => {
              const spec = loadWorkspace(file);
              return `${id}.yml ok${spec.warnings.length ? c.yellow(` (${spec.warnings.length} warnings)`) : ""}`;
            }),
          );
        }
      } catch (error) {
        checks.push([false, (error as Error).message]);
      }

      for (const [state, message] of checks)
        say(
          `${state === true ? "✅" : state === "warn" ? "⚠️ " : "❌"} ${message}`,
        );
      if (checks.some(([state]) => state === false)) process.exitCode = 1;
    });
};
