import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import { c, hint, say, table } from "../../shared/ui.ts";
import type { Alias } from "../model.ts";
import { loadContext } from "../context.ts";
import { tildify } from "../paths.ts";
import { resolve } from "../resolve.ts";
import { pill } from "../ui.ts";

const describe = (alias: Alias): string => {
  const kind =
    alias.kind === "function"
      ? "⚡ function"
      : alias.kind === "expanded"
        ? `📁 ${tildify(alias.source ?? "")}`
        : "";
  return [alias.description, kind].filter(Boolean).join("  ");
};

export const register = (program: Command): void => {
  program
    .command("list")
    .description("List aliases, grouped, with their state")
    .option("-g, --group <name>", "only this group")
    .option("--json", "machine-readable output")
    .action((opts: { group?: string; json?: boolean }) => {
      const { model } = loadContext();
      const shown = resolve(model.rows).filter(
        (r) => opts.group === undefined || r.alias.group === opts.group,
      );
      if (opts.group !== undefined && shown.length === 0) {
        throw new CliError(`No alias group named "${opts.group}"`);
      }
      if (opts.json) {
        say(JSON.stringify(shown, null, 2));
        return;
      }
      if (shown.length === 0) {
        say("📭 No aliases yet");
        hint("Run `aliaz add` to create one");
        return;
      }
      table(
        ["STATE", "ALIAS", "COMMAND", "GROUP", "DESCRIPTION"],
        shown.map(({ alias, state }) => [
          pill(state),
          c.bold(alias.name),
          alias.command,
          `📂 ${alias.group}`,
          c.dim(describe(alias)),
        ]),
      );
      const bad = shown.filter((r) => r.state !== "active").length;
      say();
      say(
        `${shown.length} aliases` +
          (bad > 0 ? `, ${bad} need attention (run aliaz doctor)` : ""),
      );
    });
};
