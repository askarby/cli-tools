import { inspectPackage } from "./inspect.ts";
import type { Pkg } from "./packages.ts";

export type Action =
  | { kind: "link"; pkg: string; source: string; dest: string }
  | { kind: "unlink"; pkg: string; source: string; dest: string }
  | { kind: "skip"; pkg: string; dest: string; reason: string }
  | { kind: "conflict"; pkg: string; dest: string; reason: string };

/** Pure planning: looks at the filesystem, changes nothing. */
export const planLink = (pkgs: Pkg[], target: string): Action[] =>
  pkgs.flatMap((pkg) =>
    inspectPackage(pkg, target).map((i): Action => {
      const base = { pkg: pkg.name, dest: i.dest };
      switch (i.state) {
        case "missing":
          return { kind: "link", ...base, source: i.entry.source };
        case "linked":
          return { kind: "skip", ...base, reason: "already linked" };
        default:
          return {
            kind: "conflict",
            ...base,
            reason: i.detail ?? i.state,
          };
      }
    }),
  );

export const planUnlink = (pkgs: Pkg[], target: string): Action[] =>
  pkgs.flatMap((pkg) =>
    inspectPackage(pkg, target).map((i): Action => {
      const base = { pkg: pkg.name, dest: i.dest };
      if (i.state === "linked" && !i.viaParent) {
        return { kind: "unlink", ...base, source: i.entry.source };
      }
      if (i.state === "linked") {
        return {
          kind: "skip",
          ...base,
          reason: "linked through a parent directory link",
        };
      }
      return {
        kind: "skip",
        ...base,
        reason: i.state === "missing" ? "not linked" : "not a dotty link",
      };
    }),
  );
