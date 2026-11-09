import {
  lstatSync,
  readdirSync,
  realpathSync,
  rmSync,
  existsSync,
} from "node:fs";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  join,
  parse,
  relative,
  resolve,
  sep,
} from "node:path";

/** A file inside a root that must exist for `safeRemove` to wipe anything in it. */
export const MANAGED_MARKER = ".cli-tools-managed";

export const DEFAULT_MAX_ENTRIES = 1000;

/** Names that are never removed, wherever they appear in the target path. */
const PROTECTED_NAMES = new Set([".git", ".ssh", ".gnupg", "node_modules"]);

export class SafetyError extends Error {
  override name = "SafetyError";
}

export interface SafeRemoveOptions {
  /** Directory the target must be strictly inside. Must contain `MANAGED_MARKER`. */
  root: string;
  /** Report what would be removed without touching anything. */
  dryRun?: boolean;
  /** Abort if the target (including everything below it) has more entries than this. */
  maxEntries?: number;
}

export interface SafeRemoveResult {
  /** Absolute paths that were removed (or would be, when `dryRun`). */
  entries: string[];
  dryRun: boolean;
}

const depth = (path: string): number =>
  path.split(sep).filter((part) => part !== "").length;

/** Real path of `path`; for a symlink, the real parent plus the link's own name. */
const resolveWithoutFollowingLink = (path: string): string => {
  const absolute = resolve(path);
  if (lstatSync(absolute).isSymbolicLink()) {
    return join(realpathSync(dirname(absolute)), basename(absolute));
  }
  return realpathSync(absolute);
};

/** Every path at or below `path`, without following symlinks. */
const collect = (
  path: string,
  limit: number,
  found: string[] = [],
): string[] => {
  found.push(path);
  if (found.length > limit) {
    throw new SafetyError(
      `refusing to remove more than ${limit} entries (found more below ${path})`,
    );
  }
  if (lstatSync(path).isDirectory()) {
    for (const name of readdirSync(path))
      collect(join(path, name), limit, found);
  }
  return found;
};

const validateRoot = (rootInput: string): string => {
  if (rootInput.trim() === "") throw new SafetyError("root must not be empty");
  if (!existsSync(rootInput)) {
    throw new SafetyError(`root does not exist: ${rootInput}`);
  }
  const root = realpathSync(resolve(rootInput));
  const home = realpathSync(homedir());
  if (root === parse(root).root || depth(root) < 2) {
    throw new SafetyError(`root is too shallow: ${root}`);
  }
  if (root === home || home.startsWith(root + sep)) {
    throw new SafetyError(
      `root must not be the home directory or contain it: ${root}`,
    );
  }
  if (!existsSync(join(root, MANAGED_MARKER))) {
    throw new SafetyError(
      `root is not marked as managed (missing ${MANAGED_MARKER}): ${root}`,
    );
  }
  return root;
};

/**
 * The only sanctioned way for tools to delete files or directories.
 *
 * Removes `target` only if, after resolving `..` and symlinks, it is strictly
 * inside `options.root`, and neither it nor any ancestor up to the root is on
 * the protected list. Throws `SafetyError` otherwise, and removes nothing.
 */
export const safeRemove = (
  target: string,
  options: SafeRemoveOptions,
): SafeRemoveResult => {
  const dryRun = options.dryRun ?? false;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;

  if (typeof target !== "string" || target.trim() === "") {
    throw new SafetyError("target must not be empty");
  }
  const root = validateRoot(options.root);

  if (!lstatOrNull(resolve(target))) {
    throw new SafetyError(`target does not exist: ${target}`);
  }
  const resolved = resolveWithoutFollowingLink(target);

  const rel = relative(root, resolved);
  if (rel === "")
    throw new SafetyError(`refusing to remove the root itself: ${root}`);
  if (rel === ".." || rel.startsWith(".." + sep) || resolve(rel) === rel) {
    throw new SafetyError(
      `target is outside the allowed root: ${resolved} (root ${root})`,
    );
  }

  const home = realpathSync(homedir());
  if (resolved === home || home.startsWith(resolved + sep)) {
    throw new SafetyError(
      `refusing to remove the home directory or its parent: ${resolved}`,
    );
  }
  const protectedName = rel
    .split(sep)
    .find((part) => PROTECTED_NAMES.has(part));
  if (protectedName !== undefined) {
    throw new SafetyError(
      `refusing to remove protected path (${protectedName}): ${resolved}`,
    );
  }
  if (basename(resolved) === MANAGED_MARKER) {
    throw new SafetyError(`refusing to remove the managed marker: ${resolved}`);
  }

  const entries = collect(resolved, maxEntries);
  if (!dryRun) rmSync(resolved, { recursive: true, force: false });
  return { entries, dryRun };
};

const lstatOrNull = (path: string): ReturnType<typeof lstatSync> | null => {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
};
