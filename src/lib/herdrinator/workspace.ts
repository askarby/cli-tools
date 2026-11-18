import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { parse } from "yaml";
import { CliError } from "../shared/errors.ts";
import { expandHome } from "./paths.ts";
import type { Rc } from "./rc.ts";

export type Layout =
  | "even-horizontal"
  | "even-vertical"
  | "main-vertical"
  | "main-horizontal"
  | "tiled";

export interface WindowSpec {
  name: string;
  root: string;
  pre: string[];
  layout: Layout;
  /** One entry per pane; each pane is a list of commands (possibly empty). */
  panes: string[][];
}

export interface WorkspaceSpec {
  /** File stem, used on the command line. */
  id: string;
  /** Label of the herdr workspace (YAML `name`, falling back to the file stem). */
  name: string;
  file: string;
  root: string;
  /** Local commands run once before the workspace is built (`pre`, `on_project_start`). */
  onStart: string[];
  /** Commands sent to every pane before its own (`pre_window`, `pre_tab`). */
  preWindow: string[];
  windows: WindowSpec[];
  startupWindow: string | undefined;
  warnings: string[];
}

const LAYOUTS: readonly string[] = [
  "even-horizontal",
  "even-vertical",
  "main-vertical",
  "main-horizontal",
  "tiled",
];
const SUPPORTED_KEYS = new Set([
  "name",
  "project_name",
  "root",
  "project_root",
  "windows",
  "pre",
  "pre_window",
  "pre_tab",
  "on_project_start",
  "startup_window",
]);
const EXTENSIONS = [".yml", ".yaml"];

type Dict = Record<string, unknown>;
const isDict = (value: unknown): value is Dict =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** tmuxinator allows a string or a list wherever commands are accepted. */
const commands = (value: unknown, where: string): string[] => {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === "string"))
    return value as string[];
  throw new CliError(`${where}: expected a command or a list of commands`);
};

const parsePane = (value: unknown, where: string): string[] => {
  if (isDict(value)) {
    const [first, ...rest] = Object.values(value);
    if (rest.length > 0)
      throw new CliError(`${where}: a pane may only have one title`);
    return commands(first, where); // `- title: command` — the title is ignored
  }
  return commands(value, where);
};

const parseWindow = (
  entry: unknown,
  index: number,
  root: string,
): WindowSpec => {
  const where = `windows[${index}]`;
  if (!isDict(entry) || Object.keys(entry).length !== 1) {
    throw new CliError(`${where}: expected a single \`name: ...\` entry`);
  }
  const [name, body] = Object.entries(entry)[0] as [string, unknown];

  let panes: string[][];
  let layout: Layout = "tiled";
  let windowRoot = root;
  let pre: string[] = [];

  if (isDict(body)) {
    if (body["layout"] !== undefined) {
      if (
        typeof body["layout"] === "string" &&
        LAYOUTS.includes(body["layout"])
      )
        layout = body["layout"] as Layout;
      else layout = "tiled";
    }
    if (typeof body["root"] === "string")
      windowRoot = resolve(root, expandHome(body["root"]));
    pre = commands(body["pre"], `${where}.pre`);
    const list = body["panes"] ?? [null];
    if (!Array.isArray(list))
      throw new CliError(`${where}.panes: expected a list`);
    panes = list.map((pane, i) => parsePane(pane, `${where}.panes[${i}]`));
  } else if (Array.isArray(body)) {
    panes = body.map((pane, i) => parsePane(pane, `${where}.panes[${i}]`));
  } else {
    panes = [commands(body, where)];
  }
  if (panes.length === 0) panes = [[]];
  return { name, root: windowRoot, pre, layout, panes };
};

export const loadWorkspace = (file: string): WorkspaceSpec => {
  const text = readFileSync(file, "utf8");
  let doc: unknown;
  try {
    doc = parse(text);
  } catch (error) {
    throw new CliError(`Could not parse ${file}`, (error as Error).message);
  }
  if (doc === null || doc === undefined) {
    throw new CliError(
      `${file} has no content yet (only comments)`,
      "Edit it: herdrinator edit " + basename(file, extname(file)),
    );
  }
  if (!isDict(doc))
    throw new CliError(`${file}: expected a YAML mapping at the top level`);

  const id = basename(file, extname(file));
  const warnings: string[] = [];
  if (text.includes("<%"))
    warnings.push(
      "ERB templates (<% %>) are not supported and were left as-is",
    );
  for (const key of Object.keys(doc)) {
    if (!SUPPORTED_KEYS.has(key))
      warnings.push(`'${key}' is not supported and was ignored`);
  }

  const rootValue = doc["root"] ?? doc["project_root"];
  const root =
    typeof rootValue === "string"
      ? resolve(expandHome(rootValue))
      : process.cwd();
  const nameValue = doc["name"] ?? doc["project_name"];
  const windows = doc["windows"];
  if (!Array.isArray(windows) || windows.length === 0) {
    throw new CliError(`${file}: 'windows' must be a non-empty list`);
  }

  try {
    return {
      id,
      name: typeof nameValue === "string" && nameValue !== "" ? nameValue : id,
      file,
      root,
      onStart: [
        ...commands(doc["pre"], "pre"),
        ...commands(doc["on_project_start"], "on_project_start"),
      ],
      preWindow: [
        ...commands(doc["pre_window"], "pre_window"),
        ...commands(doc["pre_tab"], "pre_tab"),
      ],
      windows: windows.map((entry, index) => parseWindow(entry, index, root)),
      startupWindow:
        doc["startup_window"] === undefined
          ? undefined
          : String(doc["startup_window"]),
      warnings,
    };
  } catch (error) {
    if (error instanceof CliError)
      throw new CliError(`${file}: ${error.message}`, error.hint);
    throw error;
  }
};

export const searchDirs = (rc: Rc): string[] => [
  rc.workspacesDir,
  ...rc.extraDirs,
];

/** Every workspace file across the search dirs; the first dir wins on name clashes. */
export const listWorkspaceFiles = (rc: Rc): { id: string; file: string }[] => {
  const found = new Map<string, string>();
  for (const dir of searchDirs(rc)) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir).sort()) {
      const id = basename(entry, extname(entry));
      if (EXTENSIONS.includes(extname(entry)) && !found.has(id))
        found.set(id, join(dir, entry));
    }
  }
  return [...found].map(([id, file]) => ({ id, file }));
};

export const findWorkspaceFile = (rc: Rc, name: string): string => {
  const match = listWorkspaceFiles(rc).find((entry) => entry.id === name);
  if (match) return match.file;

  const similar = listWorkspaceFiles(rc)
    .map((entry) => entry.id)
    .filter((id) => id.includes(name) || name.includes(id));
  const suggestion =
    similar.length > 0 ? ` Did you mean: ${similar.join(", ")}?` : "";
  throw new CliError(
    `No workspace named '${name}' in ${searchDirs(rc).join(", ")}.${suggestion}`,
    `Create one with: herdrinator new ${name}`,
  );
};
