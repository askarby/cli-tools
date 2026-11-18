import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Drift guard: the new-tool skill is the catalogue of shared code. A file added
// to src/lib/shared/ without an entry there would make the next tool re-discover it.
const SHARED = import.meta.dirname;
const SKILL = resolve(SHARED, "../../../.agents/skills/new-tool/SKILL.md");

describe("new-tool skill catalogue", () => {
  const skill = readFileSync(SKILL, "utf8");
  const files = readdirSync(SHARED).filter(
    (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
  );

  it("finds the shared files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files)("lists %s", (name) => {
    expect(
      skill,
      `add \`${name}\` to ${join(".agents/skills/new-tool/SKILL.md")}`,
    ).toContain(`\`${name}\``);
  });
});
