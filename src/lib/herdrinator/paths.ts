import { homedir } from "node:os";
import { join } from "node:path";

export const expandHome = (path: string): string =>
  path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;

export const configDir = (): string =>
  join(
    process.env["XDG_CONFIG_HOME"] || join(homedir(), ".config"),
    "herdrinator",
  );

export const rcPath = (): string => join(configDir(), "herdrinatorrc.toml");

export const defaultWorkspacesDir = (): string =>
  join(configDir(), "workspaces");
