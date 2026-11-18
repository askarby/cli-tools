import { dirname, join, resolve } from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSandbox, type Sandbox } from "../shared/test-utils.ts";

// Slow smoke test: proves bin/ launcher -> tsx -> entrypoint wiring only.
const LAUNCHER = resolve(import.meta.dirname, "../../../bin/aliaz");

let sandbox: Sandbox;
beforeEach(() => {
  sandbox = createSandbox();
});
afterEach(() => sandbox.cleanup());

const aliaz = (args: string[]): SpawnSyncReturns<string> =>
  spawnSync("/bin/bash", [LAUNCHER, ...args], {
    encoding: "utf8",
    env: {
      PATH: [dirname(process.execPath), "/usr/bin", "/bin"].join(":"),
      HOME: join(sandbox.work, "home"),
      XDG_CONFIG_HOME: join(sandbox.work, "config"),
      XDG_STATE_HOME: join(sandbox.work, "state"),
      NO_COLOR: "1",
    },
  });

describe("bin/aliaz", () => {
  it.each([["--help"], ["-h"], ["add", "--help"]])(
    "shows help: %s",
    (...args) => {
      const result = aliaz(args);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Usage:");
      if (args.length === 1) expect(result.stdout).toContain("Good to know:");
    },
    20_000,
  );

  it("init, add and generate produce a sourceable file", () => {
    expect(aliaz(["init"]).status).toBe(0);
    expect(aliaz(["add", "-n", "gs", "-c", "git status"]).status).toBe(0);
    const file = join(sandbox.work, "state", "aliaz", "aliases.bash");
    expect(readFileSync(file, "utf8")).toContain("alias gs='git status'");
  }, 30_000);
});
