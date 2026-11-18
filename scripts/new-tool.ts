import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { CliError } from "../src/lib/shared/errors.ts";
import { c, hint, ok, say, step, warn } from "../src/lib/shared/ui.ts";

/** Scaffolds a new tool: launcher, entrypoint, commander skeleton, test, CI job, README stub. */

const NAME = /^[a-z][a-z0-9-]*$/;
const RESERVED = new Set(["shared", "scripts", "tools"]);

const TOOL_ENTRY = `import { run } from "../lib/__NAME__/cli.ts";

await run(process.argv.slice(2));
`;

const CLI = `import type { Command } from "commander";
import { buildProgram as build, runCli, type CliSpec } from "../shared/cli.ts";
import { clackPrompts, type Prompts } from "../shared/prompts.ts";
import { c } from "../shared/ui.ts";
import { register as hello } from "./commands/hello.ts";

const EXAMPLES =
  "\\n" +
  c.bold("Examples:") +
  "\\n  __NAME__ hello world  " +
  c.gray("say hello") +
  "\\n";

/** Everything interactive, injectable for tests. */
export interface Deps {
  prompts: Prompts;
  isInteractive: () => boolean;
}

export const defaultDeps: Deps = {
  prompts: clackPrompts,
  isInteractive: () => Boolean(process.stdin.isTTY && process.stdout.isTTY),
};

const spec: CliSpec<Deps> = {
  name: "__NAME__",
  description: "🛠️  __NAME__",
  helpText: EXAMPLES,
  registrars: [hello],
};

export const buildProgram = (deps: Deps = defaultDeps): Command =>
  build(spec, deps);

export const run = (argv: string[], deps: Deps = defaultDeps): Promise<void> =>
  runCli(spec, argv, deps);
`;

const HELLO = `import type { Command } from "commander";
import { ok } from "../../shared/ui.ts";

/** Example command: replace or delete it. */
export const register = (program: Command): void => {
  program
    .command("hello")
    .description("👋 Say hello (example command)")
    .argument("[name]", "who to greet", "world")
    .action((name: string) => {
      ok("Hello, " + name + "!");
    });
};
`;

const TEST = `import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createHarness,
  fakePrompts,
  type Harness,
} from "../shared/test-harness.ts";
import { run, type Deps } from "./cli.ts";

let h: Harness<Deps>;
beforeEach(() => {
  h = createHarness<Deps>({
    run,
    defaultDeps: () => ({
      prompts: fakePrompts([]),
      isInteractive: () => false,
    }),
  });
});
afterEach(() => h.cleanup());

describe("__NAME__ hello", () => {
  it("greets the world by default", async () => {
    expect(await h.cli(["hello"])).toContain("Hello, world!");
    expect(process.exitCode).toBeUndefined();
  });

  it("greets by name", async () => {
    expect(await h.cli(["hello", "dotty"])).toContain("Hello, dotty!");
  });
});
`;

const TOOL_AGENTS = `# __NAME__

Notes for working in src/lib/__NAME__/. Agents read this before touching the tool.

- Purpose: TODO
- Config: TODO
- Quirks: TODO
`;

const CI_JOB = `  __NAME__:
    uses: ./.github/workflows/tool-pipeline.yml
    with:
      tool: __NAME__
      lint-paths: src/tools/__NAME__.ts src/lib/__NAME__
      test-paths: src/lib/__NAME__
      smoke-args: --help

`;

const README_SECTION = `## __NAME__

TODO: describe what __NAME__ does and its commands.

`;

export interface ScaffoldOptions {
  /** Repo root to scaffold into. */
  root: string;
  dryRun?: boolean;
}

export interface ScaffoldResult {
  created: string[];
  inserted: string[];
  warnings: string[];
  dryRun: boolean;
}

export const assertToolName = (name: string): void => {
  if (!NAME.test(name) || RESERVED.has(name)) {
    throw new CliError(
      `Invalid tool name: "${name}"`,
      "Use lowercase letters, digits and '-', starting with a letter (not shared/scripts/tools)",
    );
  }
};

const fill = (template: string, name: string): string =>
  template.replaceAll("__NAME__", name);

/**
 * Creates the tool's files and inserts its CI job and README stub. Never
 * overwrites or deletes: if any target exists nothing is written.
 */
export const scaffold = (
  name: string,
  options: ScaffoldOptions,
): ScaffoldResult => {
  assertToolName(name);
  const root = resolve(options.root);
  const dryRun = options.dryRun ?? false;

  const hello = join(root, "bin", "hello");
  if (!existsSync(hello)) {
    throw new CliError(`Not a cli-tools root (no bin/hello): ${root}`);
  }
  const launcher = readFileSync(hello, "utf8").replace(
    "run_tool hello",
    `run_tool ${name}`,
  );

  const files: { rel: string; content: string; mode?: number }[] = [
    { rel: `bin/${name}`, content: launcher, mode: 0o755 },
    { rel: `src/tools/${name}.ts`, content: fill(TOOL_ENTRY, name) },
    { rel: `src/lib/${name}/cli.ts`, content: fill(CLI, name) },
    { rel: `src/lib/${name}/commands/hello.ts`, content: HELLO },
    { rel: `src/lib/${name}/commands.test.ts`, content: fill(TEST, name) },
    { rel: `src/lib/${name}/AGENTS.md`, content: fill(TOOL_AGENTS, name) },
  ];
  const existing = files.filter((f) => existsSync(join(root, f.rel)));
  if (existing.length > 0) {
    throw new CliError(
      `${name} already exists: nothing was written`,
      existing.map((f) => f.rel).join(", "),
    );
  }

  const inserts: { rel: string; marker: string; text: string }[] = [
    {
      rel: ".github/workflows/ci.yml",
      marker: "  shared:\n",
      text: fill(CI_JOB, name),
    },
    {
      rel: "README.md",
      marker: "## Scripts",
      text: fill(README_SECTION, name),
    },
  ];
  const warnings: string[] = [];
  const edits = inserts.flatMap((insert) => {
    const path = join(root, insert.rel);
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    const at = current.indexOf(insert.marker);
    if (at === -1) {
      warnings.push(
        `${insert.rel}: marker ${JSON.stringify(insert.marker.trim())} not found; add this by hand:\n${insert.text}`,
      );
      return [];
    }
    return [
      {
        path,
        rel: insert.rel,
        next: current.slice(0, at) + insert.text + current.slice(at),
      },
    ];
  });

  if (!dryRun) {
    for (const file of files) {
      const path = join(root, file.rel);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.content, { flag: "wx" });
      if (file.mode) chmodSync(path, file.mode);
    }
    for (const edit of edits) writeFileSync(edit.path, edit.next);
  }
  return {
    created: files.map((f) => f.rel),
    inserted: edits.map((e) => e.rel),
    warnings,
    dryRun,
  };
};

const main = (argv: string[]): void => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", short: "n" },
      root: { type: "string" },
    },
  });
  const [name] = positionals;
  if (!name || positionals.length > 1) {
    throw new CliError(
      "Usage: npm run new-tool -- <name> [--dry-run] [--root <dir>]",
    );
  }
  const root = values.root ?? resolve(import.meta.dirname, "..");
  const result = scaffold(name, { root, dryRun: values["dry-run"] ?? false });

  step(result.dryRun ? "Would create:" : "Created:");
  for (const rel of result.created) say(`  📄 ${rel}`);
  for (const rel of result.inserted) say(`  ✏️  ${rel} (inserted)`);
  for (const message of result.warnings) warn(message);
  if (result.dryRun) return hint("dry run: nothing was written");
  ok(`Scaffolded ${c.bold(name)}`);
  say(c.bold("\nNext:"));
  say(
    "  1. Replace the example command; fill in src/lib/" +
      name +
      "/AGENTS.md and the README stub",
  );
  say(
    "  2. Reuse src/lib/shared/ (see the new-tool skill); ask before adding dependencies",
  );
  say("  3. npm run check, then ./install.sh and try ./bin/" + name);
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    console.error(`❌ ${error.message}`);
    if (error.hint) say(`💡 ${c.dim(error.hint)}`);
    process.exitCode = 1;
  }
}
