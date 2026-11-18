import { CliError } from "../../shared/errors.ts";
import type { Deps } from "../cli.ts";
import {
  cleanDescription,
  DEFAULT_GROUP,
  isValidName,
  validateCommand,
  validateDir,
  validateFunctionName,
  validateGlob,
  validateGroup,
  validateName,
  type Spec,
} from "../model.ts";

export interface AddOptions {
  name?: string;
  command?: string;
  description?: string;
  group?: string;
  dir?: string;
  function?: boolean;
  filesOnly?: boolean;
  dirsOnly?: boolean;
  stripExt?: boolean;
  match?: string;
  namePrefix?: string;
}

export type AddKind = "alias" | "expand" | "function";

const check = (fn: (v: string) => unknown) => (v: string) => {
  try {
    fn(v.trim());
    return undefined;
  } catch (error) {
    return error instanceof CliError ? error.message : String(error);
  }
};

/** Which kind the flags imply, or a prompt when nothing does. */
export const chooseKind = async (
  opts: AddOptions,
  deps: Deps,
): Promise<AddKind> => {
  if (opts.function) return "function";
  if (opts.dir !== undefined) return "expand";
  if (opts.name !== undefined && opts.command !== undefined) return "alias";
  if (!deps.isInteractive()) {
    throw new CliError(
      "Pass --name and --command (or --dir) when not run interactively",
    );
  }
  return deps.prompts.select<AddKind>("What do you want to add?", [
    { value: "alias", label: "An alias", hint: "alias gs='git status'" },
    {
      value: "expand",
      label: "One alias per entry in a directory",
      hint: "snapshot, refreshed by `aliaz sync`",
    },
    {
      value: "function",
      label: "A function that picks an entry at runtime",
      hint: "proj <tab>, always current",
    },
  ]);
};

const answer = async (
  value: string | undefined,
  deps: Deps,
  message: string,
  options: {
    validate?: (v: string) => string | undefined;
    initial?: string;
  } = {},
): Promise<string> =>
  (
    value ??
    (await deps.prompts.text({
      message,
      ...(options.validate ? { validate: options.validate } : {}),
      ...(options.initial !== undefined
        ? { initialValue: options.initial }
        : {}),
    }))
  ).trim();

/** Description and group, asked only when interactive. */
const common = async (opts: AddOptions, deps: Deps) => {
  const interactive = deps.isInteractive();
  const description = cleanDescription(
    opts.description ??
      (interactive
        ? await deps.prompts.text({ message: "Description (optional)" })
        : ""),
  );
  const group = validateGroup(
    (
      opts.group ??
      (interactive
        ? await deps.prompts.text({
            message: "Group",
            initialValue: DEFAULT_GROUP,
          })
        : DEFAULT_GROUP)
    ).trim() || DEFAULT_GROUP,
  );
  return { description, group };
};

const filters = (opts: AddOptions) => {
  if (opts.filesOnly && opts.dirsOnly) {
    throw new CliError("--files-only and --dirs-only exclude each other");
  }
  return {
    filesOnly: Boolean(opts.filesOnly),
    dirsOnly: Boolean(opts.dirsOnly),
  };
};

export interface Added {
  spec: Spec;
  summary: string;
  /** Name that may hide a real command, for a warning. */
  name?: string;
}

export const addAlias = async (
  spec: Spec,
  opts: AddOptions,
  deps: Deps,
): Promise<Added> => {
  const taken = new Set(
    [...spec.aliases, ...spec.functions].map((a) => a.name),
  );
  const name = await answer(opts.name, deps, "Alias name", {
    validate: (v) =>
      !isValidName(v.trim())
        ? "Letters, digits, '.', '_' and '-' only"
        : taken.has(v.trim())
          ? "Already exists"
          : undefined,
  });
  validateName(name);
  if (taken.has(name)) {
    throw new CliError(
      `"${name}" already exists`,
      "Remove it first with `aliaz remove`",
    );
  }
  const command = validateCommand(await answer(opts.command, deps, "Command"));
  const { description, group } = await common(opts, deps);
  return {
    spec: {
      ...spec,
      aliases: [...spec.aliases, { group, name, command, description }],
    },
    summary: `${name} → ${command}`,
    name,
  };
};

export const addExpand = async (
  spec: Spec,
  opts: AddOptions,
  deps: Deps,
): Promise<Added> => {
  const dir = validateDir(
    await answer(opts.dir, deps, "Directory to read entries from", {
      validate: check(validateDir),
    }),
  );
  const command = validateCommand(
    await answer(
      opts.command,
      deps,
      "Command ({entry} marks where the entry goes; appended if absent)",
    ),
  );
  const match = opts.match === undefined ? undefined : validateGlob(opts.match);
  const { description, group } = await common(opts, deps);
  const rule = {
    group,
    dir,
    command,
    namePrefix: opts.namePrefix ?? "",
    stripExt: Boolean(opts.stripExt),
    ...(match ? { match } : {}),
    description,
    ...filters(opts),
  };
  if (rule.namePrefix !== "") validateName(rule.namePrefix);
  return {
    spec: { ...spec, expands: [...spec.expands, rule] },
    summary: `one alias per entry of ${dir} → ${command}`,
  };
};

export const addFunction = async (
  spec: Spec,
  opts: AddOptions,
  deps: Deps,
): Promise<Added> => {
  const taken = new Set(
    [...spec.aliases, ...spec.functions].map((a) => a.name),
  );
  const name = validateFunctionName(
    await answer(opts.name, deps, "Function name", {
      validate: check(validateFunctionName),
    }),
  );
  if (taken.has(name)) throw new CliError(`"${name}" already exists`);
  const dir = validateDir(
    await answer(opts.dir, deps, "Directory to read entries from", {
      validate: check(validateDir),
    }),
  );
  const command = validateCommand(
    await answer(
      opts.command,
      deps,
      "Command ({entry} marks where the entry goes)",
    ),
  );
  const { description, group } = await common(opts, deps);
  return {
    spec: {
      ...spec,
      functions: [
        ...spec.functions,
        { group, name, dir, command, description, ...filters(opts) },
      ],
    },
    summary: `${name} <entry> → ${command}`,
    name,
  };
};
