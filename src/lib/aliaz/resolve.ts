import { accessSync, constants, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import type { Alias } from "./model.ts";
import { expandHome } from "./paths.ts";

export type State = "active" | "shadowed" | "broken";

export interface Resolved {
  alias: Alias;
  state: State;
  /** Why the state is not `active`. */
  detail?: string;
}

/** Shell builtins that are legitimately not found on PATH. */
const BUILTINS = new Set([
  ".",
  "cd",
  "echo",
  "eval",
  "exec",
  "exit",
  "export",
  "pushd",
  "popd",
  "pwd",
  "source",
  "test",
  "unset",
]);

const isExecutable = (path: string): boolean => {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** Finds `name` on PATH (or checks it as a path when it contains a `/`). */
export const which = (name: string, pathVar = process.env["PATH"]): boolean => {
  if (name.includes("/")) {
    const path = expandHome(name);
    return isAbsolute(path) ? isExecutable(path) : true;
  }
  return (pathVar ?? "")
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => isExecutable(join(dir, name)));
};

/** First word of a command, or undefined when it starts with `VAR=value`. */
const firstWord = (command: string): string | undefined => {
  const word = command.trim().split(/\s+/)[0] ?? "";
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(word) ? undefined : word;
};

/** Classifies each alias: duplicate name, shadowed real command, or missing target. */
export const resolve = (
  aliases: Alias[],
  pathVar = process.env["PATH"],
): Resolved[] => {
  const seen = new Set<string>();
  return aliases.map((alias): Resolved => {
    if (seen.has(alias.name)) {
      return { alias, state: "shadowed", detail: "duplicate alias name" };
    }
    seen.add(alias.name);
    if (which(alias.name, pathVar)) {
      return {
        alias,
        state: "shadowed",
        detail: `hides the command '${alias.name}' on PATH`,
      };
    }
    const word = firstWord(alias.command);
    if (word && !BUILTINS.has(word) && !which(word, pathVar)) {
      return { alias, state: "broken", detail: `'${word}' not found` };
    }
    return { alias, state: "active" };
  });
};
