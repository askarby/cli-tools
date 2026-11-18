import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHarness, type Harness } from "../../shared/test-harness.ts";
import { defaultDeps, run, type Deps } from "../cli.ts";
import { configDir, defaultWorkspacesDir } from "../paths.ts";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  spawnSync: vi.fn(() => ({ status: 0 })),
}));
const childProcess = await import("node:child_process");

let h: Harness<Deps>;

beforeEach(() => {
  h = createHarness<Deps>({
    run,
    // The real exec, with node:child_process mocked above.
    defaultDeps: () => defaultDeps,
    setup: () => {
      vi.stubEnv("VISUAL", "");
      vi.stubEnv("EDITOR", "");
    },
  });
});
afterEach(() => h.cleanup());

const workspaceFile = (name: string): string =>
  join(defaultWorkspacesDir(), `${name}.yml`);

describe("setup", () => {
  it("creates rc and example, and is idempotent", async () => {
    await h.cli(["setup"]);
    const rc = join(configDir(), "herdrinatorrc.toml");
    expect(existsSync(rc)).toBe(true);
    expect(existsSync(workspaceFile("bob"))).toBe(true);

    writeFileSync(rc, "# mine\n");
    await h.cli(["setup"]);
    expect(readFileSync(rc, "utf8")).toBe("# mine\n");
    expect(process.exitCode).toBeUndefined();
  });

  it("does not widen scope when HOME is empty", async () => {
    vi.stubEnv("HOME", "");
    await h.cli(["setup"]);
    expect(process.exitCode).toBeUndefined();
    expect(existsSync(workspaceFile("bob"))).toBe(true);
  });
});

describe("new", () => {
  it("creates a workspace file once", async () => {
    await h.cli(["new", "amy"]);
    expect(existsSync(workspaceFile("amy"))).toBe(true);
    expect(process.exitCode).toBeUndefined();

    await h.cli(["new", "amy"]);
    expect(process.exitCode).toBe(1);
    expect(h.stderr()).toContain("already exists");
  });

  it.each(["..", ".hidden", "a/b", "a\\b", "bad name", "x\0y"])(
    "rejects invalid name %j and writes nothing",
    async (name) => {
      await h.cli(["new", name]);
      expect(process.exitCode).toBe(1);
      expect(h.stderr()).toContain("not a valid");
      expect(existsSync(defaultWorkspacesDir())).toBe(false);
      expect(existsSync(join(configDir(), "..", ".yml"))).toBe(false);
    },
  );

  it("accepts names with dots, dashes and underscores", async () => {
    await h.cli(["new", "my_proj-1.v2"]);
    expect(existsSync(workspaceFile("my_proj-1.v2"))).toBe(true);
  });
});

describe("edit", () => {
  it("fails without an editor and spawns nothing", async () => {
    mkdirSync(defaultWorkspacesDir(), { recursive: true });
    writeFileSync(workspaceFile("bob"), "");
    await h.cli(["edit", "bob"]);
    expect(process.exitCode).toBe(1);
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
  });

  it("fails for an unknown workspace", async () => {
    vi.stubEnv("EDITOR", "vim");
    await h.cli(["edit", "ghost"]);
    expect(process.exitCode).toBe(1);
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
  });

  it("passes the file path via the environment, never inside the shell string", async () => {
    vi.stubEnv("EDITOR", "vim");
    mkdirSync(defaultWorkspacesDir(), { recursive: true });
    const file = workspaceFile("bob");
    writeFileSync(file, "");
    await h.cli(["edit", "bob"]);
    const [command, options] = vi.mocked(childProcess.spawnSync).mock
      .calls[0] as unknown as [string, { env: Record<string, string> }];
    expect(command).toBe('vim "$HERDRINATOR_FILE"');
    expect(command).not.toContain(file);
    expect(options.env["HERDRINATOR_FILE"]).toBe(file);
    expect(h.stdout()).not.toContain("❌");
  });
});
