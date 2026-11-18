import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { say } from "../../shared/ui.ts";
import { loadConfig } from "../config.ts";
import { findOrphans, inspectPackage } from "../inspect.ts";
import { listPackages } from "../packages.ts";
import { configPath, tildify } from "../paths.ts";

type Check = [ok: boolean | "warn", message: string];

export const register = (program: Command): void => {
  program
    .command("doctor")
    .description("Check the config, the repo and every link for problems")
    .action(() => {
      const checks: Check[] = [];
      try {
        const config = loadConfig();
        checks.push([true, `config: ${tildify(configPath())}`]);
        const repoOk =
          existsSync(config.repo) && statSync(config.repo).isDirectory();
        checks.push(
          repoOk
            ? [true, `repo: ${tildify(config.repo)}`]
            : [
                false,
                `repo missing or not a directory: ${tildify(config.repo)}`,
              ],
        );
        checks.push(
          existsSync(config.target)
            ? [true, `target: ${tildify(config.target)}`]
            : [false, `target missing: ${tildify(config.target)}`],
        );
        if (repoOk) {
          if (!existsSync(join(config.repo, ".git"))) {
            checks.push(["warn", "repo is not a git repository"]);
          }
          const pkgs = listPackages(config);
          for (const o of findOrphans(pkgs, config.target, config.repo)) {
            checks.push([
              false,
              `${o.pkg}: orphan link ${tildify(o.link)} → ${tildify(o.to)} (file removed from repo)`,
            ]);
          }
          for (const pkg of pkgs) {
            const found = inspectPackage(pkg, config.target);
            const problems = found.filter(
              (i) => i.state !== "linked" && i.state !== "missing",
            );
            const linked = found.filter((i) => i.state === "linked").length;
            for (const i of problems) {
              checks.push([
                i.state === "broken" ? false : "warn",
                `${pkg.name}: ${tildify(i.dest)}: ${i.detail ?? i.state}`,
              ]);
            }
            if (linked > 0 && linked < found.length) {
              checks.push([
                "warn",
                `${pkg.name}: partially linked (${linked}/${found.length}); run dotty link ${pkg.name}`,
              ]);
            }
            if (
              problems.length === 0 &&
              (linked === 0 || linked === found.length)
            ) {
              checks.push([
                true,
                linked === 0
                  ? `${pkg.name}: not linked`
                  : `${pkg.name}: ${linked} links ok`,
              ]);
            }
          }
        }
      } catch (error) {
        checks.push([false, (error as Error).message]);
      }
      for (const [state, message] of checks) {
        say(
          `${state === true ? "✅" : state === "warn" ? "⚠️ " : "❌"} ${message}`,
        );
      }
      if (checks.some(([state]) => state === false)) process.exitCode = 1;
    });
};
