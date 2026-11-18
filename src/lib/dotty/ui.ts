import { c, say, table } from "../shared/ui.ts";
import type { Action } from "./planner.ts";
import { tildify } from "./paths.ts";

export type PackageState = "linked" | "partial" | "unlinked" | "broken";

export const statePill = (state: PackageState): string => {
  switch (state) {
    case "linked":
      return `🟢 ${c.green("LINKED")}`;
    case "partial":
      return `🟡 ${c.yellow("PARTIAL")}`;
    case "broken":
      return `🔴 ${c.red("BROKEN")}`;
    case "unlinked":
      return `⚪ ${c.gray("UNLINKED")}`;
  }
};

const describe = (action: Action): string => {
  switch (action.kind) {
    case "link":
      return `🔗 ${c.green("link")}`;
    case "unlink":
      return `🧹 ${c.cyan("unlink")}`;
    case "skip":
      return `⏭️  ${c.gray(action.reason)}`;
    case "conflict":
      return `⚠️  ${c.yellow("conflict")} ${c.dim(`(${action.reason})`)}`;
  }
};

export const printActions = (actions: Action[]): void =>
  table(
    ["PACKAGE", "ACTION", "PATH"],
    actions.map((a) => [c.bold(a.pkg), describe(a), tildify(a.dest)]),
  );

export const dryRunNote = (): void =>
  say(`💡 ${c.dim("dry run: nothing was changed")}`);

export const plural = (n: number, word: string): string =>
  `${n} ${word}${n === 1 ? "" : "s"}`;
