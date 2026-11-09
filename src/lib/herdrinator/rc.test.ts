import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSandbox, type Sandbox } from "../shared/test-utils.ts";
import { CliError } from "./errors.ts";
import { configDir } from "./paths.ts";
import { loadRc } from "./rc.ts";

let sandbox: Sandbox;

beforeEach(() => {
  sandbox = createSandbox();
  vi.stubEnv("HOME", join(sandbox.work, "home"));
  vi.stubEnv("XDG_CONFIG_HOME", join(sandbox.work, "config"));
});
afterEach(() => {
  vi.unstubAllEnvs(); // HOME must not point into the sandbox while it is removed
  sandbox.cleanup();
});

const writeRc = (text: string): void => {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(join(configDir(), "herdrinatorrc.toml"), text);
};

describe("loadRc", () => {
  it("returns defaults when there is no rc file", () => {
    expect(loadRc()).toEqual({
      workspacesDir: join(configDir(), "workspaces"),
      extraDirs: [],
      editor: "",
      focus: true,
      fromFile: false,
    });
  });

  it("reads values and expands ~", () => {
    writeRc(
      'workspaces_dir = "~/ws"\nextra_dirs = ["~/more"]\neditor = "vim"\n[defaults]\nfocus = false\n',
    );
    const rc = loadRc();
    expect(rc).toEqual({
      workspacesDir: join(sandbox.work, "home", "ws"),
      extraDirs: [join(sandbox.work, "home", "more")],
      editor: "vim",
      focus: false,
      fromFile: true,
    });
  });

  it.each([
    ["broken toml", "workspaces_dir = "],
    ["non-string dir", "workspaces_dir = 3"],
    ["bad extra_dirs", "extra_dirs = [1]"],
    ["bad focus", "[defaults]\nfocus = 'yes'"],
  ])("rejects %s", (_label, text) => {
    writeRc(text);
    expect(() => loadRc()).toThrow(CliError);
  });
});
