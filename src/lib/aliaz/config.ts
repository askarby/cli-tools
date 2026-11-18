import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { parse, stringify } from "smol-toml";
import { CliError } from "../shared/errors.ts";
import {
  configPath,
  defaultAliasesPath,
  expandHome,
  isShell,
  tildify,
  type Shell,
} from "./paths.ts";

export interface Config {
  /** Absolute path of the aliases file. */
  aliasesFile: string;
  /** Shells a cached file is generated for. */
  shells: Shell[];
  /** True when a config file was read (false: built-in defaults). */
  fromFile: boolean;
}

export const DEFAULT_SHELLS: Shell[] = ["zsh", "bash", "fish"];

const absolutePath = (file: string, key: string, value: unknown): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CliError(`${file}: '${key}' must be a non-empty string`);
  }
  const expanded = expandHome(value.trim());
  if (!isAbsolute(expanded)) {
    throw new CliError(
      `${file}: '${key}' must be an absolute path or start with ~/`,
      `got "${value}"`,
    );
  }
  return expanded;
};

const parseShells = (file: string, value: unknown): Shell[] => {
  if (value === undefined) return DEFAULT_SHELLS;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((v) => typeof v !== "string" || !isShell(v))
  ) {
    throw new CliError(
      `${file}: 'shells' must be a non-empty list of sh, bash, zsh, fish`,
    );
  }
  return value as Shell[];
};

/** Reads config.toml; a missing file means defaults (the file is optional). */
export const loadConfig = (): Config => {
  const file = configPath();
  if (!existsSync(file)) {
    return {
      aliasesFile: defaultAliasesPath(),
      shells: DEFAULT_SHELLS,
      fromFile: false,
    };
  }
  let raw: Record<string, unknown>;
  try {
    raw = parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new CliError(`Could not parse ${file}`, (error as Error).message);
  }
  return {
    aliasesFile:
      raw["aliases_file"] === undefined
        ? defaultAliasesPath()
        : absolutePath(file, "aliases_file", raw["aliases_file"]),
    shells: parseShells(file, raw["shells"]),
    fromFile: true,
  };
};

/** Writes the config file, creating its directory. Refuses to overwrite. */
export const writeConfig = (): { file: string } => {
  const file = configPath();
  if (existsSync(file)) {
    throw new CliError(
      `${tildify(file)} already exists`,
      "Edit it by hand; aliaz init never overwrites",
    );
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, stringify({ shells: DEFAULT_SHELLS }) + "\n", {
    flag: "wx",
  });
  return { file };
};
