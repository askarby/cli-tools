import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { vi } from "vitest";
import type { Prompts } from "./prompts.ts";
import { createSandbox, type Sandbox } from "./test-utils.ts";

const ANSI = /\u001b\[[0-9;]*m/g;

/** Sandboxed home and file helpers, for tests that don't run a whole CLI. */
export interface Environment {
  sandbox: Sandbox;
  /** Sandboxed `$HOME` (`HOME` is stubbed to it; `XDG_CONFIG_HOME` to `home/.config`). */
  home: string;
  /** Sandbox work directory; `home` lives inside it. */
  work: string;
  /** Writes a file (creating parents) and returns its path. */
  write: (path: string, content?: string) => string;
  /** Writes a file relative to `home`. */
  homeFile: (rel: string, content?: string) => string;
  isLink: (path: string) => boolean;
  linkTarget: (path: string) => string;
  read: (path: string) => string;
  /** Call from `afterEach`. Unstubs env before cleaning up. */
  cleanup: () => void;
}

/**
 * Sandboxed HOME and XDG_CONFIG_HOME plus file helpers. Never touches the real
 * machine. Use `createHarness` when the test also runs the tool's CLI.
 */
export const createEnvironment = (): Environment => {
  const sandbox = createSandbox();
  const work = sandbox.work;
  const home = join(work, "home");
  mkdirSync(home, { recursive: true });
  vi.stubEnv("HOME", home);
  vi.stubEnv("XDG_CONFIG_HOME", join(home, ".config"));

  const write = (path: string, content = ""): string => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return path;
  };
  return {
    sandbox,
    home,
    work,
    write,
    homeFile: (rel, content = "live") => write(join(home, rel), content),
    isLink: (path) => {
      try {
        return lstatSync(path).isSymbolicLink();
      } catch {
        return false;
      }
    },
    linkTarget: (path) => readlinkSync(path),
    read: (path) => readFileSync(path, "utf8"),
    cleanup: () => {
      process.exitCode = undefined;
      vi.unstubAllEnvs(); // HOME must not point into the sandbox while it is removed
      sandbox.cleanup();
    },
  };
};

export interface HarnessOptions<D> {
  /** The tool's in-process entry, e.g. `run` from `src/lib/<tool>/cli.ts`. */
  run: (args: string[], deps: D) => Promise<void>;
  /** Fresh default (fake) dependencies for each call. */
  defaultDeps: () => D;
  /** Runs once after HOME/XDG are stubbed, e.g. to write a config file or stub more env. */
  setup?: (harness: Harness<D>) => void;
}

export interface Harness<D> extends Environment {
  /**
   * Runs the tool in-process and returns stdout+stderr with colours stripped.
   * Each call resets the captured output and `process.exitCode`; `deps`
   * override `defaultDeps()`.
   */
  cli: (args: string[], deps?: Partial<D>) => Promise<string>;
  /** `console.log` output of the last `cli()` call, colours stripped. */
  stdout: () => string;
  /** `console.error` output of the last `cli()` call, colours stripped. */
  stderr: () => string;
}

/**
 * Command-level test harness: an `Environment` plus captured console output
 * and an in-process runner.
 */
export const createHarness = <D>(options: HarnessOptions<D>): Harness<D> => {
  const env = createEnvironment();

  let out: string[] = [];
  let err: string[] = [];
  let both: string[] = [];
  const strip = (parts: unknown[]): string =>
    parts.map(String).join(" ").replace(ANSI, "");
  vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => {
    out.push(strip(parts));
    both.push(strip(parts));
  });
  vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
    err.push(strip(parts));
    both.push(strip(parts));
  });

  const harness: Harness<D> = {
    ...env,
    cli: async (args, deps = {}) => {
      out = [];
      err = [];
      both = [];
      process.exitCode = undefined;
      await options.run(args, { ...options.defaultDeps(), ...deps });
      return both.join("\n");
    },
    stdout: () => out.join("\n"),
    stderr: () => err.join("\n"),
  };
  options.setup?.(harness);
  return harness;
};

export interface FakePrompts extends Prompts {
  /** Every question asked, in order. */
  asked: string[];
}

/** Scripted answers, consumed in order. Throws if the tool asks more than expected. */
export const fakePrompts = (
  answers: (string | boolean | string[])[],
): FakePrompts => {
  const asked: string[] = [];
  const next = (message: string): string | boolean | string[] => {
    asked.push(message);
    if (answers.length === 0) throw new Error(`unexpected prompt: ${message}`);
    return answers.shift() as string | boolean | string[];
  };
  return {
    asked,
    text: async ({ message }) => next(message) as string,
    confirm: async (message) => next(message) as boolean,
    select: async (message) => next(message) as never,
    multiselect: async (message) => next(message) as never,
    path: async (message) => next(message) as string,
  };
};
