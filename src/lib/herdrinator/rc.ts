import { existsSync, readFileSync } from "node:fs";
import { parse } from "smol-toml";
import { CliError } from "../shared/errors.ts";
import { defaultWorkspacesDir, expandHome, rcPath } from "./paths.ts";

export interface Rc {
  /** Where `<name>.yml` workspace files live (and where `new` writes). */
  workspacesDir: string;
  /** Extra directories searched after `workspacesDir`. */
  extraDirs: string[];
  /** Editor command for `edit`; empty falls back to $VISUAL / $EDITOR. */
  editor: string;
  /** Focus the workspace after `start`. */
  focus: boolean;
  /** True when a real rc file was read (false → built-in defaults). */
  fromFile: boolean;
}

const str = (value: unknown, key: string, fallback: string): string => {
  if (value === undefined) return fallback;
  if (typeof value !== "string")
    throw new CliError(`${rcPath()}: '${key}' must be a string`);
  return value;
};

export const loadRc = (): Rc => {
  const defaults: Rc = {
    workspacesDir: defaultWorkspacesDir(),
    extraDirs: [],
    editor: "",
    focus: true,
    fromFile: false,
  };
  const file = rcPath();
  if (!existsSync(file)) return defaults;

  let doc: Record<string, unknown>;
  try {
    doc = parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new CliError(`Could not parse ${file}`, (error as Error).message);
  }

  const extra = doc["extra_dirs"] ?? [];
  if (
    !Array.isArray(extra) ||
    extra.some((entry) => typeof entry !== "string")
  ) {
    throw new CliError(`${file}: 'extra_dirs' must be an array of strings`);
  }
  const section = (doc["defaults"] ?? {}) as Record<string, unknown>;
  if (section["focus"] !== undefined && typeof section["focus"] !== "boolean") {
    throw new CliError(`${file}: 'defaults.focus' must be true or false`);
  }

  return {
    workspacesDir: expandHome(
      str(doc["workspaces_dir"], "workspaces_dir", defaults.workspacesDir),
    ),
    extraDirs: (extra as string[]).map(expandHome),
    editor: str(doc["editor"], "editor", ""),
    focus: (section["focus"] as boolean | undefined) ?? true,
    fromFile: true,
  };
};
