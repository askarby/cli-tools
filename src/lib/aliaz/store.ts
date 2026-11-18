import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { parse, stringify } from "smol-toml";
import { CliError } from "../shared/errors.ts";
import {
  cleanDescription,
  emptySpec,
  RESERVED,
  validateCommand,
  validateDir,
  validateFunctionName,
  validateGlob,
  validateGroup,
  validateName,
  type ExpandRule,
  type FunctionRule,
  type Spec,
} from "./model.ts";
import { tildify } from "./paths.ts";

type Table = Record<string, unknown>;

const isTable = (value: unknown): value is Table =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (
  where: string,
  table: Table,
  key: string,
  required = false,
): string => {
  const value = table[key];
  if (value === undefined && !required) return "";
  if (typeof value !== "string") {
    throw new CliError(`${where}: '${key}' must be a string`);
  }
  return value;
};

const bool = (where: string, table: Table, key: string): boolean => {
  const value = table[key] ?? false;
  if (typeof value !== "boolean") {
    throw new CliError(`${where}: '${key}' must be true or false`);
  }
  return value;
};

const filters = (where: string, table: Table) => {
  const filesOnly = bool(where, table, "files_only");
  const dirsOnly = bool(where, table, "dirs_only");
  if (filesOnly && dirsOnly) {
    throw new CliError(`${where}: files_only and dirs_only exclude each other`);
  }
  return { filesOnly, dirsOnly };
};

const rules = (where: string, value: unknown): Table[] => {
  if (!Array.isArray(value) || value.some((v) => !isTable(v))) {
    throw new CliError(`${where} must be an array of tables`);
  }
  return value as Table[];
};

const parseExpand = (group: string, where: string, t: Table): ExpandRule => ({
  group,
  dir: validateDir(str(where, t, "dir", true)),
  command: validateCommand(str(where, t, "command", true)),
  namePrefix: str(where, t, "name_prefix"),
  stripExt: bool(where, t, "strip_ext"),
  ...(t["match"] === undefined
    ? {}
    : { match: validateGlob(str(where, t, "match")) }),
  description: cleanDescription(str(where, t, "description")),
  ...filters(where, t),
});

const parseFunction = (
  group: string,
  where: string,
  t: Table,
): FunctionRule => ({
  group,
  name: validateFunctionName(str(where, t, "name", true)),
  dir: validateDir(str(where, t, "dir", true)),
  command: validateCommand(str(where, t, "command", true)),
  description: cleanDescription(str(where, t, "description")),
  ...filters(where, t),
});

/** Reads the aliases file (missing file = empty). Validates everything. */
export const loadSpec = (file: string): Spec => {
  const spec = emptySpec();
  if (!existsSync(file)) return spec;
  let doc: Table;
  try {
    doc = parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new CliError(`Could not parse ${file}`, (error as Error).message);
  }
  for (const [group, body] of Object.entries(doc)) {
    const where = `${tildify(file)}: [${group}]`;
    if (!isTable(body)) throw new CliError(`${where} must be a table`);
    validateGroup(group);
    for (const [key, entry] of Object.entries(body)) {
      if (key === "expand") {
        for (const t of rules(`${where}.expand`, entry)) {
          spec.expands.push(parseExpand(group, `${where}.expand`, t));
        }
      } else if (key === "function") {
        for (const t of rules(`${where}.function`, entry)) {
          spec.functions.push(parseFunction(group, `${where}.function`, t));
        }
      } else {
        if (!isTable(entry) || typeof entry["command"] !== "string") {
          throw new CliError(`${where}.${key} needs a string 'command'`);
        }
        spec.aliases.push({
          group,
          name: validateName(key),
          command: validateCommand(entry["command"]),
          description: cleanDescription(
            str(`${where}.${key}`, entry, "description"),
          ),
        });
      }
    }
  }
  return spec;
};

const withFlags = (r: { filesOnly: boolean; dirsOnly: boolean }) => ({
  ...(r.filesOnly ? { files_only: true } : {}),
  ...(r.dirsOnly ? { dirs_only: true } : {}),
});

const described = (description: string) => (description ? { description } : {});

/** Writes the aliases file atomically (temp file + rename). Comments are not kept. */
export const saveSpec = (file: string, spec: Spec): void => {
  const doc: Record<string, Record<string, unknown>> = {};
  const group = (name: string): Record<string, unknown> => (doc[name] ??= {});
  for (const a of spec.aliases) {
    group(a.group)[a.name] = {
      command: a.command,
      ...described(a.description),
    };
  }
  for (const r of spec.expands) {
    const list = ((group(r.group)["expand"] as unknown[]) ??= []);
    list.push({
      dir: r.dir,
      command: r.command,
      ...(r.namePrefix ? { name_prefix: r.namePrefix } : {}),
      ...(r.stripExt ? { strip_ext: true } : {}),
      ...(r.match ? { match: r.match } : {}),
      ...withFlags(r),
      ...described(r.description),
    });
  }
  for (const f of spec.functions) {
    const list = ((group(f.group)["function"] as unknown[]) ??= []);
    list.push({
      name: f.name,
      dir: f.dir,
      command: f.command,
      ...withFlags(f),
      ...described(f.description),
    });
  }
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  writeFileSync(temp, stringify(doc) + "\n");
  renameSync(temp, file);
};

export { RESERVED };
