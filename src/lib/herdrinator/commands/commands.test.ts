import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSandbox, type Sandbox } from "../../shared/test-utils.ts";
import { run } from "../cli.ts";
import { configDir, defaultWorkspacesDir } from "../paths.ts";

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
  vi.stubEnv("VISUAL", "");
  vi.stubEnv("EDITOR", "");
  out = vi.spyOn(console, "log").mockImplementation(() => {});
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.exitCode = undefined;
  vi.unstubAllEnvs(); // HOME must not point into the sandbox while it is removed
  sandbox.cleanup();
});

const workspaceFile = (name: string): string =>
  join(defaultWorkspacesDir(), `${name}.yml`);

describe("setup", () => {
  it("creates rc and example, and is idempotent", async () => {
    await run(["setup"]);
    const rc = join(configDir(), "herdrinatorrc.toml");
    expect(existsSync(rc)).toBe(true);
    expect(existsSync(workspaceFile("bob"))).toBe(true);

    writeFileSync(rc, "# mine\n");
    await run(["setup"]);
    expect(readFileSync(rc, "utf8")).toBe("# mine\n");
    expect(process.exitCode).toBeUndefined();
  });

  it("does not widen scope when HOME is empty", async () => {
    vi.stubEnv("HOME", "");
    await run(["setup"]);
    expect(process.exitCode).toBeUndefined();
    expect(existsSync(workspaceFile("bob"))).toBe(true);
  });
});

describe("new", () => {
  it("creates a workspace file once", async () => {
    await run(["new", "amy"]);
    expect(existsSync(workspaceFile("amy"))).toBe(true);
    expect(process.exitCode).toBeUndefined();

    await run(["new", "amy"]);
    expect(process.exitCode).toBe(1);
    expect(err).toHaveBeenCalledWith(expect.stringContaining("already exists"));
  });

  it.each(["..", ".hidden", "a/b", "a\\b", "bad name", "x\0y"])(
    "rejects invalid name %j and writes nothing",
    async (name) => {
      await run(["new", name]);
      expect(process.exitCode).toBe(1);
      expect(err).toHaveBeenCalledWith(expect.stringContaining("not a valid"));
      expect(existsSync(defaultWorkspacesDir())).toBe(false);
      expect(existsSync(join(configDir(), "..", ".yml"))).toBe(false);
    },
  );

  it("accepts names with dots, dashes and underscores", async () => {
    await run(["new", "my_proj-1.v2"]);
    expect(existsSync(workspaceFile("my_proj-1.v2"))).toBe(true);
  });
});

describe("edit", () => {
  it("fails without an editor and spawns nothing", async () => {
    mkdirSync(defaultWorkspacesDir(), { recursive: true });
    writeFileSync(workspaceFile("bob"), "");
    await run(["edit", "bob"]);
    expect(process.exitCode).toBe(1);
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
  });

  it("fails for an unknown workspace", async () => {
    vi.stubEnv("EDITOR", "vim");
    await run(["edit", "ghost"]);
    expect(process.exitCode).toBe(1);
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
  });

  it("passes the file path via the environment, never inside the shell string", async () => {
    vi.stubEnv("EDITOR", "vim");
    mkdirSync(defaultWorkspacesDir(), { recursive: true });
    const file = workspaceFile("bob");
    writeFileSync(file, "");
    await run(["edit", "bob"]);
    const [command, options] = vi.mocked(childProcess.spawnSync).mock
      .calls[0] as unknown as [string, { env: Record<string, string> }];
    expect(command).toBe('vim "$HERDRINATOR_FILE"');
    expect(command).not.toContain(file);
    expect(options.env["HERDRINATOR_FILE"]).toBe(file);
    expect(out).not.toHaveBeenCalledWith(expect.stringContaining("❌"));
  });
});
