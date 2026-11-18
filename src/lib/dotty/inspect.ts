import {
  existsSync,
  lstatSync,
  readdirSync,
  readlinkSync,
  realpathSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { Entry, Pkg } from "./packages.ts";
import { isInside, normalize, tildify } from "./paths.ts";

export type LinkState =
  /** A link to the repo file exists (possibly through a linked parent directory). */
  | "linked"
  | "missing"
  /** A real file or directory is in the way. */
  | "conflict"
  /** A dangling symlink is in the way. */
  | "broken"
  /** A working symlink to somewhere else is in the way. */
  | "foreign";

export interface Inspection {
  entry: Entry;
  dest: string;
  state: LinkState;
  detail?: string;
  /** Linked through a symlinked parent directory (e.g. a stow-folded directory). */
  viaParent?: boolean;
}

const errorCode = (error: unknown): string | undefined =>
  (error as NodeJS.ErrnoException).code;

export const inspectEntry = (entry: Entry, target: string): Inspection => {
  const dest = join(target, entry.rel);
  let stat;
  try {
    stat = lstatSync(dest);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return { entry, dest, state: "missing" };
    if (errorCode(error) === "ENOTDIR") {
      return { entry, dest, state: "conflict", detail: "a parent is a file" };
    }
    throw error;
  }
  if (stat.isSymbolicLink()) {
    const to = normalize(resolve(dirname(dest), readlinkSync(dest)));
    if (to === normalize(entry.source)) return { entry, dest, state: "linked" };
    return existsSync(dest)
      ? { entry, dest, state: "foreign", detail: `points to ${tildify(to)}` }
      : { entry, dest, state: "broken", detail: `dangling → ${tildify(to)}` };
  }
  try {
    if (realpathSync(dest) === realpathSync(entry.source)) {
      return { entry, dest, state: "linked", viaParent: true };
    }
  } catch {
    // fall through to conflict
  }
  return {
    entry,
    dest,
    state: "conflict",
    detail: stat.isDirectory()
      ? "a directory is in the way"
      : "a real file exists",
  };
};

export const inspectPackage = (pkg: Pkg, target: string): Inspection[] =>
  pkg.entries.map((entry) => inspectEntry(entry, target));

/**
 * Dangling links into the repo that no longer match a package file, found in
 * every directory the packages link into. `pkg` is the package the link
 * pointed into (the first path segment below the repo).
 */
export const findOrphans = (
  pkgs: Pkg[],
  target: string,
  repo: string,
): { pkg: string; link: string; to: string }[] => {
  const repoRoot = normalize(repo);
  const known = new Set(
    pkgs.flatMap((p) => p.entries.map((e) => join(target, e.rel))),
  );
  const dirs = new Set(
    pkgs.flatMap((p) => p.entries.map((e) => dirname(join(target, e.rel)))),
  );
  const orphans: { pkg: string; link: string; to: string }[] = [];
  for (const dir of dirs) {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const link = join(dir, name);
      if (known.has(link) || !lstatSync(link).isSymbolicLink()) continue;
      const to = normalize(resolve(dir, readlinkSync(link)));
      if (isInside(to, repoRoot) && !existsSync(link)) {
        orphans.push({
          pkg: relative(repoRoot, to).split(sep)[0] ?? "?",
          link,
          to,
        });
      }
    }
  }
  return orphans;
};
