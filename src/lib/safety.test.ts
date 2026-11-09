import {
  existsSync,
  mkdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MANAGED_MARKER, SafetyError, safeRemove } from "./safety.ts";
import { createSandbox, type Sandbox } from "./test-utils.ts";

let sandbox: Sandbox;
let root: string;

beforeEach(() => {
  sandbox = createSandbox();
  root = join(sandbox.work, "managed");
  mkdirSync(root);
  writeFileSync(join(root, MANAGED_MARKER), "");
});

afterEach(() => sandbox.cleanup());

const file = (...parts: string[]): string => {
  const path = join(root, ...parts);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "x");
  return path;
};

describe("safeRemove: happy path", () => {
  it("removes a file and a directory tree inside the root", () => {
    const a = file("a.txt");
    const b = file("dir", "b.txt");
    safeRemove(a, { root });
    safeRemove(join(root, "dir"), { root });
    expect(existsSync(a)).toBe(false);
    expect(existsSync(b)).toBe(false);
    expect(existsSync(join(root, MANAGED_MARKER))).toBe(true);
  });

  it("dryRun reports entries and removes nothing", () => {
    const b = file("dir", "b.txt");
    const result = safeRemove(join(root, "dir"), { root, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(existsSync(b)).toBe(true);
  });
});

describe("safeRemove: refuses dangerous targets", () => {
  it.each(["", "   "])("empty target %j", (target) => {
    expect(() => safeRemove(target, { root })).toThrow(SafetyError);
  });

  it("filesystem root", () => {
    expect(() => safeRemove("/", { root })).toThrow(SafetyError);
  });

  it("the home directory", () => {
    expect(() => safeRemove(homedir(), { root })).toThrow(SafetyError);
  });

  it("the root itself", () => {
    expect(() => safeRemove(root, { root })).toThrow(/root itself/);
  });

  it("a path outside the root", () => {
    const outside = join(sandbox.work, "outside.txt");
    writeFileSync(outside, "x");
    expect(() => safeRemove(outside, { root })).toThrow(/outside/);
    expect(existsSync(outside)).toBe(true);
  });

  it("`..` traversal out of the root", () => {
    const outside = join(sandbox.work, "outside.txt");
    writeFileSync(outside, "x");
    expect(() => safeRemove(join(root, "..", "outside.txt"), { root })).toThrow(
      SafetyError,
    );
    expect(existsSync(outside)).toBe(true);
  });

  it("a symlinked directory pointing outside the root: removes the link, not the target", () => {
    const outsideDir = join(sandbox.work, "outside");
    mkdirSync(outsideDir);
    const precious = join(outsideDir, "precious.txt");
    writeFileSync(precious, "x");
    const link = join(root, "link");
    symlinkSync(outsideDir, link);

    safeRemove(link, { root });

    expect(existsSync(link)).toBe(false);
    expect(existsSync(precious)).toBe(true);
  });

  it("a path that reaches outside through a symlinked parent", () => {
    const outsideDir = join(sandbox.work, "outside");
    mkdirSync(outsideDir);
    const precious = join(outsideDir, "precious.txt");
    writeFileSync(precious, "x");
    symlinkSync(outsideDir, join(root, "link"));

    expect(() =>
      safeRemove(join(root, "link", "precious.txt"), { root }),
    ).toThrow(/outside/);
    expect(existsSync(precious)).toBe(true);
  });

  it("a root without the managed marker", () => {
    unlinkSync(join(root, MANAGED_MARKER));
    const a = file("a.txt");
    expect(() => safeRemove(a, { root })).toThrow(/not marked as managed/);
    expect(existsSync(a)).toBe(true);
  });

  it.each(["/", homedir(), "", "/tmp"])("dangerous root %j", (badRoot) => {
    expect(() => safeRemove(join(root, "x"), { root: badRoot })).toThrow(
      SafetyError,
    );
  });

  it("protected names (.git, node_modules, .ssh)", () => {
    for (const name of [".git", "node_modules", ".ssh"]) {
      const f = file(name, "x");
      expect(() => safeRemove(join(root, name), { root })).toThrow(/protected/);
      expect(existsSync(f)).toBe(true);
    }
  });

  it("the marker file itself", () => {
    expect(() => safeRemove(join(root, MANAGED_MARKER), { root })).toThrow(
      SafetyError,
    );
  });

  it("more entries than the limit, removing nothing", () => {
    const a = file("dir", "a");
    file("dir", "b");
    file("dir", "c");
    expect(() =>
      safeRemove(join(root, "dir"), { root, maxEntries: 2 }),
    ).toThrow(/more than 2/);
    expect(existsSync(a)).toBe(true);
  });

  it("a target that does not exist", () => {
    expect(() => safeRemove(join(root, "nope"), { root })).toThrow(
      /does not exist/,
    );
  });
});
