import {
  lstatSync,
  readdirSync,
  realpathSync,
  rmSync,
  existsSync,
  readlinkSync,
  unlinkSync,
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

export interface SafeUnlinkOptions {
  /** Directory every link target must resolve strictly inside (e.g. a dotfiles repo). */
  allowedRoot: string;
  /** Report what would be removed without touching anything. */
  dryRun?: boolean;
}

export interface SafeUnlinkResult {
  /** The link that was removed (or would be, when `dryRun`). */
  link: string;
  /** Where the link pointed, as an absolute path. */
  pointedTo: string;
  dryRun: boolean;
}

const validateAllowedRoot = (rootInput: string): string => {
  if (typeof rootInput !== "string" || rootInput.trim() === "") {
    throw new SafetyError("allowedRoot must not be empty");
  }
  if (!existsSync(rootInput)) {
    throw new SafetyError(`allowedRoot does not exist: ${rootInput}`);
  }
  const root = realpathSync(resolve(rootInput));
  const home = realpathSync(homedir());
  if (root === parse(root).root || depth(root) < 2) {
    throw new SafetyError(`allowedRoot is too shallow: ${root}`);
  }
  if (root === home || home.startsWith(root + sep)) {
    throw new SafetyError(
      `allowedRoot must not be the home directory or contain it: ${root}`,
    );
  }
  const protectedName = root
    .split(sep)
    .find((part) => PROTECTED_NAMES.has(part));
  if (protectedName !== undefined) {
    throw new SafetyError(
      `allowedRoot is inside a protected path (${protectedName}): ${root}`,
    );
  }
  return root;
};

/**
 * Removes a single symlink, and only a symlink: regular files and directories
 * are refused. The link must point (lexically, after `..` is resolved) inside
 * `options.allowedRoot`, so it can only ever undo links the tool itself made.
 * Dangling links are fine. The link's destination is never touched or followed.
 */
export const safeUnlink = (
  link: string,
  options: SafeUnlinkOptions,
): SafeUnlinkResult => {
  const dryRun = options.dryRun ?? false;
  if (typeof link !== "string" || link.trim() === "") {
    throw new SafetyError("link must not be empty");
  }
  const root = validateAllowedRoot(options.allowedRoot);

  const absolute = resolve(link);
  const stat = lstatOrNull(absolute);
  if (!stat) throw new SafetyError(`link does not exist: ${link}`);
  if (!stat.isSymbolicLink()) {
    throw new SafetyError(`refusing to unlink a non-symlink: ${absolute}`);
  }

  const lexical = resolve(dirname(absolute), readlinkSync(absolute));
  // Resolve the parent for real (e.g. /var -> /private/var), keeping the final name.
  const parent = lstatOrNull(dirname(lexical))
    ? realpathSync(dirname(lexical))
    : dirname(lexical);
  const pointedTo = join(parent, basename(lexical));
  const rel = relative(root, pointedTo);
  if (
    rel === "" ||
    rel === ".." ||
    rel.startsWith(".." + sep) ||
    resolve(rel) === rel
  ) {
    throw new SafetyError(
      `link does not point inside the allowed root: ${absolute} -> ${pointedTo} (root ${root})`,
    );
  }

  if (!dryRun) unlinkSync(absolute);
  return { link: absolute, pointedTo, dryRun };
};
