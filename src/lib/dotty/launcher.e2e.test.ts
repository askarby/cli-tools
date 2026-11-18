import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSandbox, type Sandbox } from "../shared/test-utils.ts";

// Slow smoke test: proves bin/ launcher -> tsx -> entrypoint wiring only.
const LAUNCHER = resolve(import.meta.dirname, "../../../bin/dotty");

let sandbox: Sandbox;
beforeEach(() => {
  sandbox = createSandbox();
});
afterEach(() => sandbox.cleanup());

describe("bin/dotty", () => {
  it.each([["--help"], ["-h"], ["link", "--help"]])(
    "shows help: %s",
    (...args) => {
      const result = spawnSync("/bin/bash", [LAUNCHER, ...args], {
        encoding: "utf8",
        env: {
          PATH: [dirname(process.execPath), "/usr/bin", "/bin"].join(":"),
          HOME: join(sandbox.work, "home"),
          XDG_CONFIG_HOME: join(sandbox.work, "config"),
          NO_COLOR: "1",
        },
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Usage:");
      if (args.length === 1) expect(result.stdout).toContain("Good to know:");
    },
    20_000,
  );
});
