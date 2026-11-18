import { c } from "../shared/ui.ts";
import type { State } from "./resolve.ts";

/** One emoji plus a coloured word per alias state. */
export const pill = (state: State): string => {
  switch (state) {
    case "active":
      return `🟢 ${c.green("ACTIVE")}`;
    case "shadowed":
      return `🟡 ${c.yellow("SHADOWED")}`;
    case "broken":
      return `🔴 ${c.red("BROKEN")}`;
  }
};

/** Doctor line: ok, warning or failure. */
export type Check = [state: boolean | "warn", message: string];

export const checkLine = ([state, message]: Check): string =>
  `${state === true ? "✅" : state === "warn" ? "⚠️ " : "❌"} ${message}`;
