import { existsSync } from "node:fs";
import type { Command } from "commander";
import { c, hint, ok, say } from "../../shared/ui.ts";
import { loadConfig, writeConfig } from "../config.ts";
import { materialize } from "../expand.ts";
import { generate } from "../generate.ts";
import { emptySpec } from "../model.ts";
import { generatedPath, tildify } from "../paths.ts";
import { saveSpec } from "../store.ts";

export const register = (program: Command): void => {
  program
    .command("init")
    .description("Create the config file and an empty aliases file")
    .action(() => {
      const { file } = writeConfig();
      ok(`Wrote ${c.bold(tildify(file))}`);
      const config = loadConfig();
      if (!existsSync(config.aliasesFile)) {
        saveSpec(config.aliasesFile, emptySpec());
        say(`📄 Created ${c.bold(tildify(config.aliasesFile))}`);
      }
      generate(materialize(emptySpec()), config.shells);

      say();
      say("Add this to your shell configuration:");
      for (const shell of config.shells) {
        say(
          `  ${c.gray(shell.padEnd(5))} source ${tildify(generatedPath(shell))}`,
        );
      }
      hint("Run `aliaz add` to create your first alias");
    });
};
