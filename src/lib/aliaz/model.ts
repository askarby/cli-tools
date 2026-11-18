import { CliError } from "../shared/errors.ts";

export type Kind = "alias" | "expanded" | "function";

/** One row the user sees: a plain alias, one entry of an expand rule, or a function. */
export interface Alias {
  group: string;
  name: string;
  command: string;
  description: string;
  kind?: Kind;
  /** Directory an expanded alias or function reads from (as written). */
  source?: string;
}

export interface Filters {
  filesOnly: boolean;
  dirsOnly: boolean;
}

/** One alias per entry of `dir`, generated when aliaz runs (a snapshot). */
export interface ExpandRule extends Filters {
  group: string;
  dir: string;
  /** Template: `{entry}` and `{dir}` are replaced; the entry is appended if absent. */
  command: string;
  namePrefix: string;
  stripExt: boolean;
  /** Glob on entry names (`*` and `?`). */
  match?: string;
  description: string;
}

/** A shell function `name <entry>` that reads `dir` every time it runs. */
export interface FunctionRule extends Filters {
  group: string;
  name: string;
  dir: string;
  command: string;
  description: string;
}

/** The aliases file as written by the user. */
export interface Spec {
  aliases: Alias[];
  expands: ExpandRule[];
  functions: FunctionRule[];
}

export const emptySpec = (): Spec => ({
  aliases: [],
  expands: [],
  functions: [],
});

export const DEFAULT_GROUP = "general";

/** Keys inside a group table that hold rules rather than aliases. */
export const RESERVED = ["expand", "function"];

const NAME = /^[A-Za-z0-9._-]+$/;
const GROUP = /^[A-Za-z0-9_-]+$/;
const FUNCTION_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;
/** No spaces, quotes or shell metacharacters: safe to paste into any shell. */
const DIR = /^[~A-Za-z0-9._/+@%{}-]+$/;
const GLOB = /^[A-Za-z0-9*?._-]+$/;

export const isValidName = (name: string): boolean =>
  NAME.test(name) && !name.startsWith("-") && !RESERVED.includes(name);

export const validateName = (name: string): string => {
  if (!isValidName(name)) {
    throw new CliError(
      `Invalid alias name "${name}"`,
      "Use letters, digits, '.', '_' and '-' (not starting with '-')",
    );
  }
  return name;
};

export const validateFunctionName = (name: string): string => {
  if (!FUNCTION_NAME.test(name) || RESERVED.includes(name)) {
    throw new CliError(
      `Invalid function name "${name}"`,
      "Use letters, digits, '_' and '-', starting with a letter or '_'",
    );
  }
  return name;
};

export const validateGroup = (group: string): string => {
  if (!GROUP.test(group)) {
    throw new CliError(
      `Invalid group name "${group}"`,
      "Use letters, digits, '_' and '-'",
    );
  }
  return group;
};

export const validateCommand = (command: string): string => {
  const trimmed = command.trim();
  if (trimmed === "" || /[\r\n]/.test(trimmed)) {
    throw new CliError("A command must be a single, non-empty line");
  }
  return trimmed;
};

export const validateDir = (dir: string): string => {
  const trimmed = dir.trim();
  if (!DIR.test(trimmed)) {
    throw new CliError(
      `Unsupported directory "${dir}"`,
      "Paths in rules may not contain spaces, quotes or shell characters; use a symlink",
    );
  }
  return trimmed;
};

export const validateGlob = (glob: string): string => {
  if (!GLOB.test(glob)) {
    throw new CliError(
      `Invalid match pattern "${glob}"`,
      "Use letters, digits, '.', '_', '-', '*' and '?'",
    );
  }
  return glob;
};

/** Descriptions end up in `#` comments: keep them on one line. */
export const cleanDescription = (description: string): string =>
  description.replace(/\s+/g, " ").trim();
