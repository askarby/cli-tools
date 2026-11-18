import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, parse } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SafetyError, safeUnlink } from "./safety.ts";
import { createSandbox, type Sandbox } from "./test-utils.ts";

let sandbox: Sandbox;
let repo: string;
let home: string;

beforeEach(() => {
  sandbox = createSandbox();
  repo = join(sandbox.work, "repo");
  home = join(sandbox.work, "home");
  mkdirSync(join(repo, "pkg"), { recursive: true });
  mkdirSync(home);
  writeFileSync(join(repo, "pkg", "rc"), "x");
});

afterEach(() => sandbox.cleanup());

const link = (name: string, target: string): string => {
  const path = join(home, name);
  symlinkSync(target, path);
  return path;
};

const exists = (path: string): boolean => {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
};

describe("safeUnlink: happy path", () => {
  it("removes a symlink pointing into the allowed root, leaving the target", () => {
    const l = link(".rc", join(repo, "pkg", "rc"));
    const result = safeUnlink(l, { allowedRoot: repo });
    expect(exists(l)).toBe(false);
    expect(existsSync(join(repo, "pkg", "rc"))).toBe(true);
    expect(result.dryRun).toBe(false);
  });

  it("removes a dangling link that points inside the root", () => {
    const l = link(".gone", join(repo, "pkg", "missing"));
    safeUnlink(l, { allowedRoot: repo });
    expect(exists(l)).toBe(false);
  });

  it("handles relative link targets", () => {
    const l = link(".rel", "../repo/pkg/rc");
    safeUnlink(l, { allowedRoot: repo });
    expect(exists(l)).toBe(false);
  });

  it("dry-run reports but removes nothing", () => {
    const l = link(".rc", join(repo, "pkg", "rc"));
    const result = safeUnlink(l, { allowedRoot: repo, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(exists(l)).toBe(true);
  });
});

describe("safeUnlink: refuses", () => {
  it("a regular file", () => {
    const f = join(home, "file");
    writeFileSync(f, "x");
    expect(() => safeUnlink(f, { allowedRoot: repo })).toThrow(SafetyError);
    expect(existsSync(f)).toBe(true);
  });

  it("a directory", () => {
    const d = join(home, "dir");
    mkdirSync(d);
    expect(() => safeUnlink(d, { allowedRoot: repo })).toThrow(/non-symlink/);
  });

  it("a link pointing outside the allowed root", () => {
    const outside = join(sandbox.work, "outside");
    writeFileSync(outside, "x");
    const l = link(".out", outside);
    expect(() => safeUnlink(l, { allowedRoot: repo })).toThrow(
      /outside|inside/,
    );
    expect(exists(l)).toBe(true);
  });

  it("a link that escapes via ..", () => {
    const l = link(".esc", join(repo, "..", "home"));
    expect(() => safeUnlink(l, { allowedRoot: repo })).toThrow(SafetyError);
  });

  it("a link pointing at the root itself", () => {
    const l = link(".root", repo);
    expect(() => safeUnlink(l, { allowedRoot: repo })).toThrow(SafetyError);
  });

  it("a missing link, empty input", () => {
    expect(() => safeUnlink(join(home, "nope"), { allowedRoot: repo })).toThrow(
      /does not exist/,
    );
    expect(() => safeUnlink("", { allowedRoot: repo })).toThrow(/empty/);
  });

  it("dangerous allowed roots: empty, missing, /, $HOME, protected", () => {
    const l = link(".rc", join(repo, "pkg", "rc"));
    expect(() => safeUnlink(l, { allowedRoot: "" })).toThrow(SafetyError);
    expect(() =>
      safeUnlink(l, { allowedRoot: join(sandbox.work, "nope") }),
    ).toThrow(/does not exist/);
    expect(() => safeUnlink(l, { allowedRoot: parse(repo).root })).toThrow(
      /shallow/,
    );
    expect(() =>
      safeUnlink(l, { allowedRoot: realpathSync(homedir()) }),
    ).toThrow(/home/);
    const git = join(repo, ".git");
    mkdirSync(git);
    expect(() => safeUnlink(l, { allowedRoot: git })).toThrow(/protected/);
    expect(exists(l)).toBe(true);
  });
});
