import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "../shared/errors.ts";
import type { Config } from "./config.ts";
import { tildify } from "./paths.ts";

/** Always left out, whatever the config says. */
export const ALWAYS_IGNORED = [".git", ".DS_Store", ".dotty-trash"];

/** One file in a package: `rel` is its path relative to the link target. */
export interface Entry {
  rel: string;
  source: string;
}

export interface Pkg {
  name: string;
  dir: string;
  entries: Entry[];
}

const globToRegExp = (glob: string): RegExp =>
  new RegExp(
    "^" +
      glob
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") +
      "$",
  );

export const isIgnored = (name: string, extra: string[]): boolean =>
  [...ALWAYS_IGNORED, ...extra].some((glob) => globToRegExp(glob).test(name));

/** Rejects names that could escape the repo or look like options. */
export const assertPackageName = (name: string): void => {
  if (
    name === "" ||
    /[/\\\0]/.test(name) ||
    name.includes("..") ||
    name.startsWith("-") ||
    name.startsWith(".")
  ) {
    throw new CliError(
      `Invalid package name: "${name}"`,
      "Use a plain folder name without slashes, and no leading '-' or '.'",
    );
  }
};

const walk = (
  dir: string,
  rel: string,
  ignore: string[],
  out: Entry[],
): void => {
  const dirents = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const dirent of dirents) {
    if (isIgnored(dirent.name, ignore)) continue;
    const path = join(dir, dirent.name);
    const childRel = rel === "" ? dirent.name : join(rel, dirent.name);
    if (dirent.isDirectory()) walk(path, childRel, ignore, out);
    else out.push({ rel: childRel, source: path });
  }
};

const loadPackage = (config: Config, name: string): Pkg => {
  const dir = join(config.repo, name);
  const entries: Entry[] = [];
  walk(dir, "", config.ignore, entries);
  return { name, dir, entries };
};

const requireRepo = (config: Config): void => {
  if (!existsSync(config.repo)) {
    throw new CliError(
      `Dotfiles repo not found: ${tildify(config.repo)}`,
      "Check `repo` in your dotty config.toml",
    );
  }
};

export const listPackages = (config: Config): Pkg[] => {
  requireRepo(config);
  return readdirSync(config.repo, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        !d.name.startsWith(".") &&
        !isIgnored(d.name, config.ignore),
    )
    .map((d) => d.name)
    .sort()
    .map((name) => loadPackage(config, name));
};

/** Packages named on the command line, or all of them with `--all`. */
export const selectPackages = (
  config: Config,
  names: string[],
  all: boolean | undefined,
): Pkg[] => {
  const available = listPackages(config);
  if (all) return available;
  if (names.length === 0) {
    throw new CliError(
      "Name at least one package, or pass --all",
      `Available: ${available.map((p) => p.name).join(", ") || "(none)"}`,
    );
  }
  return [...new Set(names)].map((name) => {
    assertPackageName(name);
    const found = available.find((p) => p.name === name);
    if (!found) {
      throw new CliError(
        `Unknown package: ${name}`,
        `Available: ${available.map((p) => p.name).join(", ") || "(none)"}`,
      );
    }
    return found;
  });
};
