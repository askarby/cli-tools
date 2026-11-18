import { lstatSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Config } from "./config.ts";
import { isIgnored, listPackages } from "./packages.ts";
import { isInside, normalize } from "./paths.ts";

/** Never offered or adopted, whatever the user picks. */
export const NEVER_ADOPT = [".git", ".ssh", ".gnupg", "node_modules"];

/** Top-level dot folders that are caches/containers, not configuration. */
const NOT_CANDIDATES = [".config", ".Trash", ".cache", ".local", ".npm"];

export interface Candidate {
  /** Absolute path of the live file or directory. */
  path: string;
  /** `~` or `~/.config`: where it lives. */
  group: string;
}

const dotEntries = (
  dir: string,
  group: string,
  config: Config,
): Candidate[] => {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const repo = normalize(config.repo);
  return names
    .filter((name) => dir !== normalize(config.target) || name.startsWith("."))
    .filter(
      (name) =>
        !NEVER_ADOPT.includes(name) &&
        !NOT_CANDIDATES.includes(name) &&
        !isIgnored(name, config.ignore),
    )
    .sort()
    .map((name) => ({ path: join(dir, name), group }))
    .filter(({ path }) => {
      try {
        if (lstatSync(path).isSymbolicLink()) return false;
      } catch {
        return false;
      }
      return !isInside(normalize(path), repo);
    });
};

/**
 * Likely things to adopt: dotfiles directly in the target and the children of
 * `<target>/.config`, minus symlinks, protected folders and anything a package
 * already holds.
 */
export const findCandidates = (config: Config): Candidate[] => {
  const target = normalize(config.target);
  const tracked = listPackages(config).flatMap((p) =>
    p.entries.map((e) => e.rel),
  );
  const isTracked = (path: string): boolean => {
    const rel = relative(target, path);
    return tracked.some((t) => t === rel || t.startsWith(rel + sep));
  };
  return [
    ...dotEntries(target, "~", config),
    ...dotEntries(join(target, ".config"), "~/.config", config),
  ].filter((c) => !isTracked(c.path));
};
