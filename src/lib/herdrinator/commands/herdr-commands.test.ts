import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSandbox, type Sandbox } from "../../shared/test-utils.ts";
import { run } from "../cli.ts";
import { createFakeHerdr, type FakeHerdr } from "../fake-herdr.ts";
import type { WorkspaceInfo } from "../herdr.ts";
import { defaultWorkspacesDir } from "../paths.ts";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  spawnSync: vi.fn(() => ({ status: 0 })),
}));
const childProcess = await import("node:child_process");

let sandbox: Sandbox;
let out: ReturnType<typeof vi.spyOn>;
let err: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sandbox = createSandbox();
  vi.stubEnv("HOME", join(sandbox.work, "home"));
  vi.stubEnv("XDG_CONFIG_HOME", join(sandbox.work, "config"));
  vi.stubEnv("HERDRINATOR_WORKSPACE_ID", "");
  vi.stubEnv("HERDR_WORKSPACE_ID", "");
  out = vi.spyOn(console, "log").mockImplementation(() => {});
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.exitCode = undefined;
  vi.unstubAllEnvs(); // HOME must not point into the sandbox while it is removed
  sandbox.cleanup();
});

const ANSI = /\u001b\[[0-9;]*m/g;
const stdout = (): string =>
  out.mock.calls
    .map((call: unknown[]) => String(call[0]).replace(ANSI, ""))
    .join("\n");
const stderr = (): string =>
  err.mock.calls
    .map((call: unknown[]) => String(call[0]).replace(ANSI, ""))
    .join("\n");

const workspace = (name: string, body: string): void => {
  mkdirSync(defaultWorkspacesDir(), { recursive: true });
  writeFileSync(join(defaultWorkspacesDir(), `${name}.yml`), body);
};
const BOB = `name: Bob\nroot: ${"/srv/bob"}\nwindows:\n  - main:\n      panes: [ls, pwd]\n  - logs: tail -f log\n`;

const go = async (
  args: string[],
  existing: Partial<WorkspaceInfo>[] = [],
): Promise<FakeHerdr> => {
  const fake = createFakeHerdr(existing);
  await run(args, { exec: fake.exec });
  return fake;
};
const verbs = (fake: FakeHerdr): string[] =>
  fake.writes().map((call) => call.slice(0, 2).join(" "));

describe("start", () => {
  beforeEach(() => workspace("bob", BOB));

  it("builds the workspace", async () => {
    const fake = await go(["start", "bob"]);
    expect(process.exitCode).toBeUndefined();
    expect(verbs(fake)).toEqual([
      "workspace create",
      "tab rename",
      "pane split",
      "pane run",
      "pane run",
      "tab create",
      "tab rename",
      "pane run",
      "workspace focus",
    ]);
    expect(stdout()).toContain("RUNNING");
  });

  it("--dry-run changes nothing", async () => {
    const fake = await go(["start", "bob", "--dry-run"]);
    expect(fake.writes()).toEqual([]);
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
    expect(stdout()).toContain("Dry run");
  });

  it("--no-focus skips the final focus", async () => {
    const fake = await go(["start", "bob", "--no-focus"]);
    expect(verbs(fake)).not.toContain("workspace focus");
  });

  it("only focuses an already running workspace (idempotent)", async () => {
    const fake = await go(["start", "bob"], [{ label: "Bob" }]);
    expect(verbs(fake)).toEqual(["workspace focus"]);
    expect(stdout()).toContain("already RUNNING");
  });

  it("--force closes then rebuilds", async () => {
    const fake = await go(["start", "bob", "--force"], [{ label: "Bob" }]);
    expect(verbs(fake).slice(0, 2)).toEqual([
      "workspace close",
      "workspace create",
    ]);
  });

  it("fails for an unknown workspace without calling herdr", async () => {
    const fake = await go(["start", "ghost"]);
    expect(process.exitCode).toBe(1);
    expect(fake.calls).toEqual([]);
    expect(stderr()).toContain("No workspace named 'ghost'");
  });

  it("runs on_project_start commands locally, not in dry-run", async () => {
    workspace("pre", "pre: echo hi\nwindows:\n  - a: ls\n");
    await go(["start", "pre"]);
    expect(childProcess.spawnSync).toHaveBeenCalledWith(
      "sh",
      ["-c", "echo hi"],
      expect.objectContaining({ cwd: expect.any(String) }),
    );
  });
});

describe("stop", () => {
  beforeEach(() => workspace("bob", BOB));

  it("closes a running workspace by file name", async () => {
    const fake = await go(["stop", "bob"], [{ label: "Bob" }]);
    expect(fake.writes()).toEqual([["workspace", "close", "w-existing0"]]);
  });

  it("closes by herdr label when there is no file", async () => {
    const fake = await go(["stop", "Adhoc"], [{ label: "Adhoc" }]);
    expect(verbs(fake)).toEqual(["workspace close"]);
  });

  it("refuses when nothing is running, closing nothing", async () => {
    const fake = await go(["stop", "bob"], [{ label: "Other" }]);
    expect(process.exitCode).toBe(1);
    expect(fake.writes()).toEqual([]);
    expect(stderr()).toContain("not running");
  });
});

describe("list", () => {
  it("says so when empty", async () => {
    await go(["list"]);
    expect(stdout()).toContain("No workspaces found");
  });

  it("reports running, closed, invalid and unmanaged workspaces", async () => {
    workspace("bob", BOB);
    workspace("amy", "windows:\n  - a: ls\n");
    workspace("broken", "windows: []\n");
    const fake = await go(["list"], [{ label: "Bob" }, { label: "Stray" }]);
    const text = stdout();
    expect(text).toMatch(/RUNNING\s+bob/);
    expect(text).toMatch(/CLOSED\s+amy/);
    expect(text).toMatch(/INVALID\s+broken/);
    expect(text).toMatch(/UNMANAGED\s+Stray/);
    expect(fake.writes()).toEqual([]);
  });
});

describe("doctor", () => {
  it("passes (with warnings) on a fresh machine", async () => {
    await go(["doctor"]);
    expect(process.exitCode).toBeUndefined();
    expect(stdout()).toContain("herdr 1.2.3");
    expect(stdout()).toContain("workspaces dir missing");
  });

  it("flags invalid workspace files and exits 1", async () => {
    workspace("broken", "windows: []\n");
    await go(["doctor"]);
    expect(process.exitCode).toBe(1);
    expect(stdout()).toContain("❌");
  });

  it("exits 1 when herdr is unavailable", async () => {
    await run(["doctor"], {
      exec: createFakeHerdr([], { failWith: new Error("nope") }).exec,
    });
    expect(process.exitCode).toBe(1);
  });
});

describe("action", () => {
  it("workspace creates and focuses", async () => {
    const fake = await go(["action", "w", "Proj", "--cwd", "/srv/p"]);
    expect(verbs(fake)).toEqual(["workspace create", "workspace focus"]);
    expect(fake.calls[0]).toContain("/srv/p");
  });

  it("tab uses the workspace from the environment and derives the name", async () => {
    vi.stubEnv("HERDRINATOR_WORKSPACE_ID", "w-env");
    const fake = await go(["action", "t", "/usr/bin/npm run dev"]);
    expect(fake.calls[0]).toEqual(expect.arrayContaining(["w-env", "npm"]));
    expect(verbs(fake)).toEqual(["tab create", "pane run"]);
  });

  it("tab falls back to the focused workspace, else fails", async () => {
    const focused = await go(
      ["action", "t", "ls", "--name", "L"],
      [{ focused: true }],
    );
    expect(focused.calls.find((call) => call[0] === "tab")).toContain(
      "w-existing0",
    );

    const none = await go(["action", "t", "ls"]);
    expect(process.exitCode).toBe(1);
    expect(none.writes()).toEqual([]);
  });
});
