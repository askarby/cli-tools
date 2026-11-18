import type { Command } from "commander";
import { c, say, table } from "../../shared/ui.ts";
import { loadContext } from "../context.ts";
import { resolve } from "../resolve.ts";
import { highlight, search } from "../search.ts";
import { pill } from "../ui.ts";

export const register = (program: Command): void => {
  program
    .command("search")
    .description("Find aliases by name, description or command")
    .argument("<query...>", "words that must all match")
    .action((words: string[]) => {
      const query = words.join(" ");
      const { model } = loadContext();
      const hits = new Set(search(model.rows, query));
      const found = resolve(model.rows)
        .filter((r) => hits.has(r.alias))
        .sort(
          (a, b) => [...hits].indexOf(a.alias) - [...hits].indexOf(b.alias),
        );
      if (found.length === 0) {
        say(`🔍 Nothing matches "${query}"`);
        return;
      }
      const mark = (s: string): string => c.bold(c.cyan(s));
      table(
        ["STATE", "ALIAS", "COMMAND", "DESCRIPTION"],
        found.map(({ alias, state }) => [
          pill(state),
          highlight(alias.name, query, mark),
          highlight(alias.command, query, mark),
          highlight(alias.description, query, mark),
        ]),
      );
      say();
      say(`🔍 ${found.length} match${found.length === 1 ? "" : "es"}`);
    });
};
