import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  isValidName,
  type Alias,
  type ExpandRule,
  type Filters,
  type FunctionRule,
  type Spec,
} from "./model.ts";
import { expandHome } from "./paths.ts";

const globToRegex = (glob: string): RegExp =>
  new RegExp(
    "^" +
      glob
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") +
      "$",
  );

export interface Scan {
  /** Entry names that survived the filters (before stripping extensions). */
  entries: string[];
  missing: boolean;
}

/** Lists a directory's visible entries, sorted, honouring files/dirs filters and a glob. */
export const scan = (dir: string, filters: Filters, match?: string): Scan => {
  const real = expandHome(dir);
  let names: string[];
  try {
    names = readdirSync(real);
  } catch {
    return { entries: [], missing: true };
  }
  const pattern = match ? globToRegex(match) : undefined;
  const entries = names
    .filter((name) => !name.startsWith("."))
    .filter((name) => !pattern || pattern.test(name))
    .filter((name) => {
      try {
        const stat = statSync(join(real, name)); // follows symlinks
        if (filters.dirsOnly) return stat.isDirectory();
        if (filters.filesOnly) return stat.isFile();
        return true;
      } catch {
        return false; // broken symlink
      }
    })
    .sort();
  return { entries, missing: false };
};

export interface Problem {
  level: "error" | "warn";
  message: string;
}

/** Everything derived from a Spec: what gets rendered, what gets shown, what is wrong. */
export interface Model {
  /** Plain and expanded aliases: rendered as `alias` lines. */
  aliases: Alias[];
  functions: FunctionRule[];
  /** Every row a user sees (aliases plus functions). */
  rows: Alias[];
  problems: Problem[];
}

export const applyTemplate = (
  template: string,
  entry: string,
  dir: string,
): string => {
  const withDir = template.replaceAll("{dir}", dir);
  return withDir.includes("{entry}")
    ? withDir.replaceAll("{entry}", entry)
    : `${withDir} ${entry}`;
};

const stripExtension = (name: string): string => name.replace(/\.[^.]+$/, "");

const expandRule = (
  rule: ExpandRule,
): { aliases: Alias[]; problems: Problem[] } => {
  const { entries, missing } = scan(rule.dir, rule, rule.match);
  const problems: Problem[] = [];
  if (missing) {
    problems.push({
      level: "error",
      message: `${rule.dir}: directory missing`,
    });
  } else if (entries.length === 0) {
    problems.push({
      level: "warn",
      message: `${rule.dir}: no matching entries`,
    });
  }
  const aliases: Alias[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const base = rule.stripExt ? stripExtension(entry) : entry;
    const name = rule.namePrefix + base;
    if (!isValidName(name) || seen.has(name)) {
      problems.push({
        level: "warn",
        message: `${rule.dir}: skipped "${entry}" (not a usable alias name)`,
      });
      continue;
    }
    seen.add(name);
    aliases.push({
      group: rule.group,
      name,
      command: applyTemplate(rule.command, entry, rule.dir),
      description: rule.description,
      kind: "expanded",
      source: rule.dir,
    });
  }
  return { aliases, problems };
};

/** Expands rules against the disk and merges everything. */
export const materialize = (spec: Spec): Model => {
  const plain = spec.aliases.map((a) => ({ ...a, kind: "alias" as const }));
  const problems: Problem[] = [];
  const expanded: Alias[] = [];
  for (const rule of spec.expands) {
    const result = expandRule(rule);
    expanded.push(...result.aliases);
    problems.push(...result.problems);
  }
  const functions = spec.functions;
  const functionRows: Alias[] = functions.map((f) => ({
    group: f.group,
    name: f.name,
    command: applyTemplate(f.command, "<entry>", f.dir),
    description: f.description,
    kind: "function",
    source: f.dir,
  }));
  for (const f of functions) {
    if (scan(f.dir, f).missing) {
      problems.push({ level: "error", message: `${f.dir}: directory missing` });
    }
  }
  const aliases = [...plain, ...expanded];
  return {
    aliases,
    functions,
    rows: [...aliases, ...functionRows],
    problems,
  };
};
