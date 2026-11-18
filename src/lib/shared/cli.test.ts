import type { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProgram, runCli, type CliSpec } from "./cli.ts";
import { CliError } from "./errors.ts";
import { SafetyError } from "./safety.ts";

const ANSI = /\u001b\[[0-9;]*m/g;

interface Deps {
  greeting: string;
}

const spec: CliSpec<Deps> = {
  name: "demo",
  description: "a demo tool",
  helpText: "\nExtra help text\n",
  registrars: [
    (program: Command, deps: Deps) => {
      program.command("hi").action(() => console.log(deps.greeting));
      program.command("cli-error").action(() => {
        throw new CliError("it broke", "try again");
      });
      program.command("cli-error-nohint").action(() => {
        throw new CliError("plain");
      });
      program.command("unsafe").action(() => {
        throw new SafetyError("nope");
      });
      program.command("bug").action(() => {
        throw new TypeError("a real bug");
      });
    },
  ],
};

let logs: string[];
let errors: string[];
let stdout: string[];

beforeEach(() => {
  logs = [];
  errors = [];
  stdout = [];
  vi.spyOn(console, "log").mockImplementation((...a) => {
    logs.push(a.join(" ").replace(ANSI, ""));
  });
  vi.spyOn(console, "error").mockImplementation((...a) => {
    errors.push(a.join(" ").replace(ANSI, ""));
  });
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout.push(String(chunk).replace(ANSI, ""));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => {
  process.exitCode = undefined;
});

const go = (...args: string[]): Promise<void> =>
  runCli(spec, args, { greeting: "hello" });

describe("buildProgram", () => {
  it("names the program, registers subcommands with the deps, and appends help text", () => {
    const program = buildProgram(spec, { greeting: "x" });
    expect(program.name()).toBe("demo");
    expect(program.commands.map((c) => c.name())).toContain("hi");
    program.outputHelp();
    const help = stdout.join("");
    expect(help).toContain("a demo tool");
    expect(help).toContain("Extra help text");
  });

  it("works without help text", () => {
    const program = buildProgram(
      { ...spec, helpText: undefined },
      { greeting: "x" },
    );
    program.outputHelp();
    expect(stdout.join("")).not.toContain("Extra help text");
  });
});

describe("runCli", () => {
  it("runs a command with the injected deps", async () => {
    await go("hi");
    expect(logs).toEqual(["hello"]);
    expect(process.exitCode).toBeUndefined();
  });

  it("prints help when there are no arguments", async () => {
    await go();
    expect(stdout.join("")).toContain("Usage: demo");
    expect(process.exitCode).toBeUndefined();
  });

  it.each([["--help"], ["-h"], ["-?"]])("prints help for %s", async (flag) => {
    await go(flag);
    expect(stdout.join("")).toContain("Usage: demo");
    expect(process.exitCode ?? 0).toBe(0);
  });

  it("turns a CliError into ❌ message + 💡 hint and exit code 1", async () => {
    await go("cli-error");
    expect(errors).toEqual(["❌ it broke"]);
    expect(logs).toEqual(["💡 try again"]);
    expect(process.exitCode).toBe(1);
  });

  it("prints no hint line when the CliError has none", async () => {
    await go("cli-error-nohint");
    expect(errors).toEqual(["❌ plain"]);
    expect(logs).toEqual([]);
    expect(process.exitCode).toBe(1);
  });

  it("turns a SafetyError into ❌ message and exit code 1", async () => {
    await go("unsafe");
    expect(errors).toEqual(["❌ nope"]);
    expect(process.exitCode).toBe(1);
  });

  it("maps commander errors (unknown command) to its exit code without throwing", async () => {
    await go("nonsense");
    expect(process.exitCode).toBe(1);
  });

  it("rethrows unexpected errors instead of hiding bugs", async () => {
    await expect(go("bug")).rejects.toThrow("a real bug");
    expect(process.exitCode).toBeUndefined();
  });
});
