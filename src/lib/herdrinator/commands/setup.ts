import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import { defaultWorkspacesDir, rcPath } from "../paths.ts";
import { exampleWorkspace, rcTemplate } from "../templates.ts";
import { c, hint, say } from "../../shared/ui.ts";

const writeOnce = (file: string, content: string): void => {
  if (existsSync(file)) {
    say(`⏭️  ${c.gray(`${file} already exists - left untouched`)}`);
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  say(`✨ Created ${c.cyan(file)}`);
};

export const register = (program: Command): void => {
  program
    .command("setup")
    .description(
      "🔧 Create the base herdrinatorrc.toml and an example workspace (bob.yml)",
    )
    .action(() => {
      const workspaces = defaultWorkspacesDir();
      writeOnce(
        rcPath(),
        rcTemplate(workspaces.replace(process.env["HOME"] || "\0", "~")),
      );
      writeOnce(join(workspaces, "bob.yml"), exampleWorkspace("bob"));
      hint("Try it out: herdrinator start bob --dry-run");
    });
};
