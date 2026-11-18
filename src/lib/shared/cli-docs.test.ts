import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { describe, expect, it } from "vitest";

const LIB = join(import.meta.dirname, "..");
const EMOJI = /\p{Extended_Pictographic}/u;

const tools = readdirSync(LIB, { withFileTypes: true })
  .filter(
    (d) =>
      d.isDirectory() &&
      d.name !== "shared" &&
      existsSync(join(LIB, d.name, "cli.ts")),
  )
  .map((d) => d.name);

const walk = (command: Command): Command[] => [
  command,
  ...command.commands.flatMap(walk),
];

describe("command documentation", () => {
  it("finds the tools", () => {
    expect(tools).toEqual(expect.arrayContaining(["dotty", "herdrinator"]));
  });

  it.each(tools)(
    "%s has no emojis in its descriptions or help",
    async (tool) => {
      const mod = (await import(`../${tool}/cli.ts`)) as {
        buildProgram: () => Command;
      };
      for (const command of walk(mod.buildProgram())) {
        expect(command.description(), command.name()).not.toMatch(EMOJI);
        expect(command.helpInformation(), command.name()).not.toMatch(EMOJI);
      }
    },
  );
});
