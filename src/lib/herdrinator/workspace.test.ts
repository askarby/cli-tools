import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSandbox, type Sandbox } from "../shared/test-utils.ts";
import { CliError } from "./errors.ts";
import type { Rc } from "./rc.ts";
import {
  findWorkspaceFile,
  listWorkspaceFiles,
  loadWorkspace,
} from "./workspace.ts";

let sandbox: Sandbox;

beforeEach(() => {
  sandbox = createSandbox();
});
afterEach(() => sandbox.cleanup());

const write = (name: string, text: string, dir = sandbox.work): string => {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, text);
  return file;
};

describe("loadWorkspace", () => {
  it("parses a full spec", () => {
    const file = write(
      "bob.yml",
      [
        "name: Bob",
        "root: /srv/bob",
        "pre: echo hi",
        "pre_window: [nvm use]",
        "startup_window: 2",
        "windows:",
        "  - editor:",
        "      layout: main-vertical",
        "      root: sub",
        "      pre: cd x",
        "      panes:",
        "        - vim",
        "        - title: ls",
        "  - server: npm start",
      ].join("\n"),
    );
    const spec = loadWorkspace(file);
    expect(spec).toMatchObject({
      id: "bob",
      name: "Bob",
      root: "/srv/bob",
      onStart: ["echo hi"],
      preWindow: ["nvm use"],
      startupWindow: "2",
      warnings: [],
    });
    expect(spec.windows[0]).toEqual({
      name: "editor",
      root: "/srv/bob/sub",
      pre: ["cd x"],
      layout: "main-vertical",
      panes: [["vim"], ["ls"]],
    });
    expect(spec.windows[1]?.panes).toEqual([["npm start"]]);
  });

  it("falls back to the file stem and warns about unsupported keys and ERB", () => {
    const file = write("x.yml", "foo: 1\nwindows:\n  - a: <%= x %>\n");
    const spec = loadWorkspace(file);
    expect(spec.name).toBe("x");
    expect(spec.warnings).toHaveLength(2);
  });

  it("reports comment-only files", () => {
    expect(() => loadWorkspace(write("e.yml", "# nothing\n"))).toThrow(
      /no content yet/,
    );
  });

  it.each([
    ["not a mapping", "- a\n- b\n"],
    ["no windows", "name: x\n"],
    ["empty windows", "windows: []\n"],
    ["bad window entry", "windows:\n  - 5\n"],
    ["bad command list", "windows:\n  - a: [1, 2]\n"],
    ["invalid yaml", "windows: [\n"],
  ])("rejects %s with a CliError", (_label, text) => {
    expect(() => loadWorkspace(write("bad.yml", text))).toThrow(CliError);
  });

  it("prefixes window errors with the file name", () => {
    const file = write("bad.yml", "windows:\n  - 5\n");
    expect(() => loadWorkspace(file)).toThrow(/bad\.yml: windows\[0\]/);
  });
});

describe("listWorkspaceFiles / findWorkspaceFile", () => {
  const rcFor = (dir: string, extra: string[] = []): Rc => ({
    workspacesDir: dir,
    extraDirs: extra,
    editor: "",
    focus: true,
    fromFile: false,
  });

  it("lists yml/yaml only, first directory wins on clashes", () => {
    const a = join(sandbox.work, "a");
    const b = join(sandbox.work, "b");
    const first = write("bob.yml", "", a);
    write("notes.txt", "", a);
    write("bob.yaml", "", b);
    const other = write("amy.yaml", "", b);
    const found = listWorkspaceFiles(rcFor(a, [b, join(b, "missing")]));
    expect(found).toEqual([
      { id: "bob", file: first },
      { id: "amy", file: other },
    ]);
  });

  it("suggests similar names when nothing matches", () => {
    const dir = join(sandbox.work, "ws");
    write("bobby.yml", "", dir);
    const rc = rcFor(dir);
    expect(findWorkspaceFile(rc, "bobby")).toBe(join(dir, "bobby.yml"));
    expect(() => findWorkspaceFile(rc, "bob")).toThrow(/Did you mean: bobby/);
  });
});

describe("environment", () => {
  it("does not read from the real cwd for the root when `root` is given", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/nowhere");
    const file = write("r.yml", "root: /srv/r\nwindows:\n  - a: ls\n");
    expect(loadWorkspace(file).root).toBe("/srv/r");
  });
});
