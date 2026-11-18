import type { Command } from "commander";
import { c, ok, say, warn } from "../../shared/ui.ts";
import { loadContext } from "../context.ts";
import { generate, namesIn } from "../generate.ts";
import { tildify } from "../paths.ts";

export const register = (program: Command): void => {
  program
    .command("sync")
    .description("Rescan rule directories and regenerate the sourceable files")
    .option("--dry-run", "show what would change without writing")
    .action((opts: { dryRun?: boolean }) => {
      const { config, model } = loadContext();
      const before = namesIn(config.shells[0] ?? "zsh");
      const now = new Set(model.rows.map((r) => r.name));
      for (const p of model.problems) {
        if (p.level === "warn") warn(p.message);
        else say(`❌ ${p.message}`);
      }
      const results = generate(model, config.shells, { dryRun: opts.dryRun });
      const added = [...now].filter((n) => !before.has(n));
      const removed = [...before].filter((n) => !now.has(n));
      for (const n of added) say(`➕ ${c.green(n)}`);
      for (const n of removed) say(`➖ ${c.red(n)}`);
      const changed = results.filter((r) => r.changed);
      if (changed.length === 0) {
        say("✨ Already up to date");
        return;
      }
      for (const r of changed) {
        ok(`${opts.dryRun ? "Would write" : "Wrote"} ${tildify(r.file)}`);
      }
    });
};
