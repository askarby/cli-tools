import type { Command } from "commander";
import { c, hint, say, table } from "../../shared/ui.ts";
import { loadConfig } from "../config.ts";
import { inspectPackage, type LinkState } from "../inspect.ts";
import { listPackages } from "../packages.ts";
import { tildify } from "../paths.ts";
import { statePill, type PackageState } from "../ui.ts";

const count = (states: LinkState[], state: LinkState): number =>
  states.filter((s) => s === state).length;

export const summarize = (
  states: LinkState[],
): { state: PackageState; notes: string } => {
  const linked = count(states, "linked");
  const broken = count(states, "broken");
  const issues = [
    broken && c.red(`${broken} broken`),
    count(states, "conflict") &&
      c.yellow(`${count(states, "conflict")} conflicting`),
    count(states, "foreign") && c.yellow(`${count(states, "foreign")} foreign`),
  ].filter(Boolean);
  const state: PackageState =
    broken > 0
      ? "broken"
      : linked === states.length && states.length > 0
        ? "linked"
        : linked === 0
          ? "unlinked"
          : "partial";
  return { state, notes: issues.join(", ") };
};

export const register = (program: Command): void => {
  program
    .command("list")
    .alias("ls")
    .description("📋 Show which packages are linked")
    .action(() => {
      const config = loadConfig();
      const pkgs = listPackages(config);
      if (pkgs.length === 0) {
        say(`📭 No packages in ${tildify(config.repo)}`);
        return hint("A package is a folder in the repo, e.g. zsh/.zshrc");
      }
      const rows = pkgs.map((pkg) => {
        const states = inspectPackage(pkg, config.target).map((i) => i.state);
        const { state, notes } = summarize(states);
        const linked = count(states, "linked");
        return [
          c.bold(pkg.name),
          statePill(state),
          `${linked}/${states.length}`,
          notes,
        ];
      });
      say(
        `📦 ${c.bold(tildify(config.repo))} → ${c.bold(tildify(config.target))}`,
      );
      say();
      table(["PACKAGE", "STATE", "LINKS", "NOTES"], rows);
    });
};
