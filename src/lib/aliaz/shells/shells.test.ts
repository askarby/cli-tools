import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Model } from "../expand.ts";
import type { Alias, FunctionRule } from "../model.ts";
import { SHELLS, type Shell } from "../paths.ts";
import { quote } from "./quote.ts";
import { GENERATED_HEADER, render } from "./render.ts";

const NASTY = [
  "plain",
  "it's",
  `say "hi"`,
  "echo $HOME `date`",
  "back\\slash",
  "a; rm -rf /",
  "multi word 'quoted' \"mixed\"",
];

const available = (shell: string): boolean =>
  spawnSync(shell, ["--version"], { stdio: "ignore" }).status === 0;

describe("quote", () => {
  it("uses single quotes and escapes embedded ones (posix)", () => {
    expect(quote("it's", "bash")).toBe(`'it'\\''s'`);
    expect(quote("a b", "zsh")).toBe(`'a b'`);
  });

  it("escapes backslash and quote for fish", () => {
    expect(quote("it's", "fish")).toBe(`'it\\'s'`);
    expect(quote("a\\b", "fish")).toBe(`'a\\\\b'`);
  });

  // Real shells are the only honest oracle for quoting.
  for (const shell of ["sh", "bash", "zsh", "fish"] as Shell[]) {
    it.skipIf(!available(shell))(
      `round-trips awkward text through real ${shell}`,
      () => {
        for (const text of NASTY) {
          const out = execFileSync(
            shell,
            ["-c", `printf %s ${quote(text, shell)}`],
            {
              encoding: "utf8",
            },
          );
          expect(out).toBe(text);
        }
      },
    );
  }
});

const modelOf = (aliases: Alias[], functions: FunctionRule[] = []): Model => ({
  aliases,
  functions,
  rows: aliases,
  problems: [],
});

describe("render", () => {
  const proj: FunctionRule = {
    group: "code",
    name: "proj",
    dir: "~/projects",
    command: "code {dir}/{entry}",
    description: "Open a project",
    filesOnly: false,
    dirsOnly: true,
  };
  const aliases: Alias[] = [
    {
      group: "git",
      name: "gs",
      command: "git status -sb",
      description: "Short status",
    },
    { group: "git", name: "say", command: "echo it's", description: "" },
    { group: "misc", name: "ll", command: "ls -la", description: "" },
  ];

  it("starts with the generated header and groups aliases", () => {
    const text = render(modelOf(aliases), "zsh");
    expect(text.startsWith(GENERATED_HEADER)).toBe(true);
    expect(text).toContain("# git");
    expect(text).toContain("# gs: Short status");
    expect(text).toContain("alias gs='git status -sb'");
    expect(text).toContain(`alias say='echo it'\\''s'`);
  });

  it("uses fish syntax for fish", () => {
    expect(render(modelOf(aliases), "fish")).toContain(
      "alias gs 'git status -sb'",
    );
  });

  for (const shell of SHELLS) {
    it.skipIf(!available(shell))(`${shell} accepts the generated file`, () => {
      const dir = mkdtempSync(join(tmpdir(), "aliaz-shell-"));
      const file = join(dir, `a.${shell}`);
      writeFileSync(file, render(modelOf(aliases, [proj]), shell));
      const args = shell === "fish" ? ["--no-execute", file] : ["-n", file];
      expect(spawnSync(shell, args).status).toBe(0);
    });
  }
});

describe("render functions", () => {
  const fn: FunctionRule = {
    group: "code",
    name: "proj",
    dir: "~/projects",
    command: "code {dir}/{entry}",
    description: "Open a project",
    filesOnly: false,
    dirsOnly: true,
  };
  const text = (shell: Shell): string => render(modelOf([], [fn]), shell);

  it("emits a validating function per shell", () => {
    expect(text("bash")).toContain("proj() {");
    expect(text("bash")).toContain('code ~/projects/"$entry" "$@"');
    expect(text("bash")).toContain('[ -d ~/projects/"$entry" ]');
    expect(text("fish")).toContain(
      "function proj --description 'Open a project'",
    );
    expect(text("fish")).toContain('code ~/projects/"$entry" $argv');
  });

  it("adds completion only where the shell supports it", () => {
    expect(text("bash")).toContain("complete -F _aliaz_proj proj");
    expect(text("zsh")).toContain("compdef _aliaz_proj proj");
    expect(text("zsh")).toContain("(N/:t)");
    expect(text("fish")).toContain("complete -c proj");
    expect(text("sh")).not.toContain("complete");
  });

  const run = (shell: Shell, dir: string, args: string): string => {
    const file = join(dir, `f.${shell}`);
    const model = modelOf([], [{ ...fn, dir }]);
    writeFileSync(file, render(model, shell));
    const script =
      shell === "fish" ? `source ${file}; ${args}` : `. ${file}; ${args}`;
    return spawnSync(shell, ["-c", script], { encoding: "utf8" }).stdout;
  };

  // Behaviour, not just syntax: the function must resolve entries and refuse bad ones.
  for (const shell of ["bash", "zsh", "fish"] as Shell[]) {
    it.skipIf(!available(shell))(`runs and validates in real ${shell}`, () => {
      const dir = mkdtempSync(join(tmpdir(), "aliaz-fn-"));
      mkdirSync(join(dir, "alpha"));
      const out = run(shell, dir, "proj alpha");
      expect(out).toBe("");
      const echoModel = modelOf(
        [],
        [{ ...fn, dir, command: "echo got {entry}" }],
      );
      const file = join(dir, `g.${shell}`);
      writeFileSync(file, render(echoModel, shell));
      const call = (arg: string): ReturnType<typeof spawnSync> =>
        spawnSync(
          shell,
          [
            "-c",
            shell === "fish"
              ? `source ${file}; proj ${arg}`
              : `. ${file}; proj ${arg}`,
          ],
          {
            encoding: "utf8",
          },
        );
      expect(call("alpha").stdout).toBe("got alpha\n");
      expect(call("nope").status).not.toBe(0);
      expect(call("../x").status).not.toBe(0);
    });
  }
});
