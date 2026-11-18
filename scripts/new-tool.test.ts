import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { check, resolveConfig } from "prettier";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CliError } from "../src/lib/shared/errors.ts";
import { createSandbox, type Sandbox } from "../src/lib/shared/test-utils.ts";
import { scaffold } from "./new-tool.ts";

const REPO = resolve(import.meta.dirname, "..");
const CI = "jobs:\n  hello:\n    uses: x\n\n  shared:\n    uses: y\n";
const README =
  "# cli-tools\n\n## Tools\n\n| Tool | What |\n| --- | --- |\n| [hello](src/lib/hello/README.md) | hi |\n\n<!-- tools:end -->\n\n## More\n";

let sandbox: Sandbox;
let root: string;

beforeEach(() => {
  sandbox = createSandbox();
  root = join(sandbox.work, "repo");
  mkdirSync(join(root, "bin"), { recursive: true });
  mkdirSync(join(root, ".github/workflows"), { recursive: true });
  copyFileSync(join(REPO, "bin/hello"), join(root, "bin/hello"));
  writeFileSync(join(root, ".github/workflows/ci.yml"), CI);
  writeFileSync(join(root, "README.md"), README);
});
afterEach(() => sandbox.cleanup());

const read = (rel: string): string => readFileSync(join(root, rel), "utf8");

describe("scaffold", () => {
  it("creates the launcher (executable, run_tool <name>), entry, lib, test and notes", () => {
    const result = scaffold("demo", { root });
    expect(result.created).toEqual([
      "bin/demo",
      "src/tools/demo.ts",
      "src/lib/demo/cli.ts",
      "src/lib/demo/commands/hello.ts",
      "src/lib/demo/commands.test.ts",
      "src/lib/demo/AGENTS.md",
      "src/lib/demo/README.md",
    ]);
    expect(statSync(join(root, "bin/demo")).mode & 0o111).not.toBe(0);
    expect(read("bin/demo")).toContain('run_tool demo "$@"');
    expect(read("bin/demo")).not.toContain("run_tool hello");
    expect(read("src/tools/demo.ts")).toContain("../lib/demo/cli.ts");
    expect(read("src/lib/demo/cli.ts")).toContain('name: "demo"');
    expect(read("src/lib/demo/commands.test.ts")).toContain(
      'describe("demo hello"',
    );
    expect(read("src/lib/demo/AGENTS.md")).toContain("src/lib/demo/");
    expect(read("src/lib/demo/cli.ts")).not.toContain("__NAME__");
  });

  it("generates files that already satisfy the repo's Prettier config", async () => {
    const { created } = scaffold("demo", { root });
    const options =
      (await resolveConfig(join(REPO, "src/tools/hello.ts"))) ?? {};
    for (const rel of created.filter((f) => f.endsWith(".ts"))) {
      const formatted = await check(read(rel), { ...options, filepath: rel });
      expect(formatted, `${rel} is not Prettier-formatted`).toBe(true);
    }
  });

  it("inserts the CI job before `shared:` and a tools table row before the marker", () => {
    const result = scaffold("demo", { root });
    expect(result.inserted).toEqual([".github/workflows/ci.yml", "README.md"]);
    const ci = read(".github/workflows/ci.yml");
    expect(ci.indexOf("  demo:")).toBeGreaterThan(ci.indexOf("  hello:"));
    expect(ci.indexOf("  demo:")).toBeLessThan(ci.indexOf("  shared:"));
    expect(ci).toContain("lint-paths: src/tools/demo.ts src/lib/demo");
    const readme = read("README.md");
    const row = "| [demo](src/lib/demo/README.md) |";
    expect(readme).toContain(row);
    expect(readme.indexOf(row)).toBeGreaterThan(readme.indexOf("[hello]"));
    expect(readme.indexOf(row)).toBeLessThan(
      readme.indexOf("<!-- tools:end -->"),
    );
    // the new row continues the table: no blank line between rows
    expect(readme).toMatch(/\| hi \|\n\| \[demo\]/);
  });

  it("creates a tool README that points at --help and has no emojis", () => {
    scaffold("demo", { root });
    const readme = read("src/lib/demo/README.md");
    expect(readme).toContain("# demo");
    expect(readme).toContain("`demo --help`");
    expect(readme).not.toContain("__NAME__");
    expect(readme).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("is not repeatable: a second run refuses and changes nothing", () => {
    scaffold("demo", { root });
    const ci = read(".github/workflows/ci.yml");
    expect(() => scaffold("demo", { root })).toThrow(/already exists/);
    expect(read(".github/workflows/ci.yml")).toBe(ci);
  });

  it("refuses when any target exists, writing nothing (not even the others)", () => {
    mkdirSync(join(root, "src/lib/demo"), { recursive: true });
    writeFileSync(join(root, "src/lib/demo/cli.ts"), "mine");
    expect(() => scaffold("demo", { root })).toThrow(CliError);
    expect(read("src/lib/demo/cli.ts")).toBe("mine");
    expect(existsSync(join(root, "bin/demo"))).toBe(false);
    expect(read("README.md")).toBe(README);
  });

  it("--dry-run reports the plan and writes nothing", () => {
    const result = scaffold("demo", { root, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.created).toHaveLength(7);
    expect(existsSync(join(root, "bin/demo"))).toBe(false);
    expect(existsSync(join(root, "src"))).toBe(false);
    expect(read(".github/workflows/ci.yml")).toBe(CI);
  });

  it("reports a missing insertion marker with the snippet, but still creates the files", () => {
    writeFileSync(join(root, "README.md"), "# nothing useful\n");
    const result = scaffold("demo", { root });
    expect(result.inserted).toEqual([".github/workflows/ci.yml"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("README.md");
    expect(result.warnings[0]).toContain("[demo](src/lib/demo/README.md)");
    expect(existsSync(join(root, "bin/demo"))).toBe(true);
    expect(read("README.md")).toBe("# nothing useful\n");
  });

  it("refuses a directory that is not a cli-tools root", () => {
    expect(() => scaffold("demo", { root: sandbox.work })).toThrow(
      /Not a cli-tools root/,
    );
  });

  it.each([
    [""],
    ["Demo"],
    ["1demo"],
    ["-rf"],
    [".hidden"],
    ["a/b"],
    ["a\\b"],
    ["../x"],
    ["demo\0"],
    ["my tool"],
    ["shared"],
    ["scripts"],
  ])("rejects the name %j", (name) => {
    expect(() => scaffold(name, { root })).toThrow(/Invalid tool name/);
    expect(existsSync(join(root, "src"))).toBe(false);
  });

  it("accepts kebab-case names", () => {
    expect(() => scaffold("my-tool2", { root })).not.toThrow();
  });
});
