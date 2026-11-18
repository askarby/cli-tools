import { mkdirSync, symlinkSync } from "node:fs";
import { dirname } from "node:path";
import { safeUnlink } from "../shared/safety.ts";
import type { Action } from "./planner.ts";

export interface ApplyOptions {
  dryRun: boolean;
  /** Links may only be removed when they point inside this repo. */
  repo: string;
}

/** Executes link/unlink actions; skips and conflicts are ignored. */
export const applyActions = (
  actions: Action[],
  options: ApplyOptions,
): void => {
  for (const action of actions) {
    if (options.dryRun) continue;
    if (action.kind === "link") {
      mkdirSync(dirname(action.dest), { recursive: true });
      symlinkSync(action.source, action.dest);
    } else if (action.kind === "unlink") {
      safeUnlink(action.dest, { allowedRoot: options.repo });
    }
  }
};
