import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute } from "node:path";
import { parse, stringify } from "smol-toml";
import { CliError } from "../shared/errors.ts";
import { configPath, expandHome, tildify } from "./paths.ts";

export interface Config {
  /** Absolute path of the local dotfiles repository. */
  repo: string;
  /** Absolute directory links are created in. Defaults to `$HOME`. */
  target: string;
  /** Extra glob patterns (matched on file names) to leave out of packages. */
  ignore: string[];
}

export const DEFAULT_IGNORE = ["README*", "LICENSE*"];

const absolutePath = (file: string, key: string, value: unknown): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CliError(`${file}: '${key}' must be a non-empty string`);
  }
  const expanded = expandHome(value);
  if (!isAbsolute(expanded)) {
    throw new CliError(
      `${file}: '${key}' must be an absolute path or start with ~/`,
      `got "${value}"`,
    );
  }
  return expanded;
};

export const loadConfig = (overrides: { target?: string } = {}): Config => {
  const file = configPath();
  if (!existsSync(file)) {
    throw new CliError(
      `No config found at ${tildify(file)}`,
      "Run `dotty init` to create one",
    );
  }
  let raw: Record<string, unknown>;
  try {
    raw = parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new CliError(`Could not parse ${file}`, (error as Error).message);
  }
  const ignore = raw["ignore"] ?? [];
  if (!Array.isArray(ignore) || ignore.some((v) => typeof v !== "string")) {
    throw new CliError(`${file}: 'ignore' must be a list of strings`);
  }
  const target =
    overrides.target !== undefined
      ? absolutePath("--target", "target", expandHome(overrides.target))
      : raw["target"] === undefined
        ? homedir()
        : absolutePath(file, "target", raw["target"]);
  return {
    repo: absolutePath(file, "repo", raw["repo"]),
    target,
    ignore: ignore as string[],
  };
};

/** Writes the config file, creating its directory. Refuses to overwrite. */
export const writeConfig = (
  repo: string,
  target?: string,
): { file: string } => {
  const file = configPath();
  if (existsSync(file)) {
    throw new CliError(
      `${tildify(file)} already exists`,
      "Edit it by hand; dotty init never overwrites",
    );
  }
  mkdirSync(dirname(file), { recursive: true });
  const body = stringify({
    repo,
    ...(target ? { target } : {}),
    ignore: DEFAULT_IGNORE,
  });
  writeFileSync(file, body + "\n", { flag: "wx" });
  return { file };
};
