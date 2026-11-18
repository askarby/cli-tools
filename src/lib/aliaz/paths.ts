import { homedir } from "node:os";
import { isAbsolute, join, sep } from "node:path";

export const SHELLS = ["sh", "bash", "zsh", "fish"] as const;
export type Shell = (typeof SHELLS)[number];

export const isShell = (value: string): value is Shell =>
  (SHELLS as readonly string[]).includes(value);

export const expandHome = (path: string): string =>
  path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;

/** `/Users/me/x` -> `~/x`, for display only. */
export const tildify = (path: string): string => {
  const home = homedir();
  if (path === home) return "~";
  return path.startsWith(home + sep)
    ? `~/${path.slice(home.length + 1)}`
    : path;
};

export const configDir = (): string =>
  join(process.env["XDG_CONFIG_HOME"] || join(homedir(), ".config"), "aliaz");

export const configPath = (): string => join(configDir(), "config.toml");

export const defaultAliasesPath = (): string =>
  join(configDir(), "aliases.toml");

export const stateDir = (): string =>
  join(
    process.env["XDG_STATE_HOME"] || join(homedir(), ".local", "state"),
    "aliaz",
  );

/** Where the generated, sourceable file for a shell lives. */
export const generatedPath = (shell: Shell): string =>
  join(stateDir(), `aliases.${shell}`);

export const isAbsolutePath = (path: string): boolean =>
  isAbsolute(expandHome(path));
