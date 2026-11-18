import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

export const expandHome = (path: string): string =>
  path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;

export const configDir = (): string =>
  join(process.env["XDG_CONFIG_HOME"] || join(homedir(), ".config"), "dotty");

export const configPath = (): string => join(configDir(), "config.toml");

/** `/Users/me/x` -> `~/x`, for display only. */
export const tildify = (path: string): string => {
  const home = homedir();
  if (path === home) return "~";
  return path.startsWith(home + sep)
    ? `~/${path.slice(home.length + 1)}`
    : path;
};

/**
 * Absolute path with the parent directory's symlinks resolved (e.g. `/var` ->
 * `/private/var` on macOS) and the final name left alone, so a symlink is
 * compared by where it lives rather than where it points.
 */
export const normalize = (path: string): string => {
  const absolute = resolve(path);
  try {
    return join(realpathSync(dirname(absolute)), basename(absolute));
  } catch {
    return absolute;
  }
};

/** True when `path` is strictly inside `root` (both already normalized). */
export const isInside = (path: string, root: string): boolean =>
  path.startsWith(root.endsWith(sep) ? root : root + sep);
