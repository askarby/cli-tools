import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSandbox, type Sandbox } from "../shared/test-utils.ts";

// Slow smoke tests: prove bin/ launcher -> tsx -> entrypoint wiring only.
// The child gets a sandboxed HOME / XDG_CONFIG_HOME and a stub `herdr`; nothing real is touched.
const LAUNCHER = resolve(import.meta.dirname, "../../../bin/herdrinator");

let sandbox: Sandbox;
let stubDir: string;
let callLog: string;

beforeEach(() => {
  sandbox = createSandbox();
  stubDir = join(sandbox.work, "stub");
  callLog = join(sandbox.work, "calls.log");
  mkdirSync(stubDir);
  const stub = join(stubDir, "herdr");
  writeFileSync(
    stub,
    `#!/bin/sh\necho "$@" >> "${callLog}"\necho '{"result":{"workspaces":[]}}'\n`,
  );
  chmodSync(stub, 0o755);
});
afterEach(() => sandbox.cleanup());

const launch = (args: string[], path: string) =>
  spawnSync("/bin/bash", [LAUNCHER, ...args], {
    encoding: "utf8",
    env: {
      PATH: path,
      HOME: join(sandbox.work, "home"),
      XDG_CONFIG_HOME: join(sandbox.work, "config"),
      NO_COLOR: "1",
    },
  });

const withNode = (...dirs: string[]): string =>
  [...dirs, dirname(process.execPath), "/usr/bin", "/bin"].join(":");

describe("bin/herdrinator", () => {
  it("runs the TypeScript entrypoint against the stub herdr", () => {
    const result = launch(["list"], withNode(stubDir));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No workspaces found");
    expect(readFileSync(callLog, "utf8")).toContain("workspace list");
  }, 20_000);

  it("fails with guidance when herdr is not installed", () => {
    const result = launch(["list"], "/usr/bin:/bin");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("'herdr' was not found on your PATH");
  });
});
