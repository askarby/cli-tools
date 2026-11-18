import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LIB = join(import.meta.dirname, "..");

/** Only these tools may know about dotfiles managers. */
const ALLOWED = new Set(["dotty", "shared"]);

/** Words that mean a tool knows its config is managed by a stow-like tool. */
const FORBIDDEN =
  /\b(dotty|stow|gnu stow|chezmoi|yadm|dotfiles?|dotfiles? repo(sitory)?)\b/i;

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : [join(dir, entry.name)],
  );

const tools = readdirSync(LIB, { withFileTypes: true })
  .filter(
    (d) =>
      d.isDirectory() &&
      !ALLOWED.has(d.name) &&
      existsSync(join(LIB, d.name, "cli.ts")),
  )
  .map((d) => d.name);

describe("tool independence", () => {
  it("finds the tools", () => {
    expect(tools).toEqual(expect.arrayContaining(["herdrinator"]));
  });

  it.each(tools)(
    "%s does not know about dotty, stow, dotfiles or similar managers",
    (tool) => {
      const root = join(LIB, "..", "..");
      const own = [
        ...files(join(LIB, tool)),
        join(root, "src", "tools", `${tool}.ts`),
        join(root, "bin", tool),
      ].filter((file) => existsSync(file));
      for (const file of own) {
        const hit = readFileSync(file, "utf8").match(FORBIDDEN);
        expect(hit?.[0], file).toBeUndefined();
      }
    },
  );
});
