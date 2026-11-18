import { existsSync } from "node:fs";
import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import { ok } from "../../shared/ui.ts";
import type { Deps } from "../cli.ts";
import { loadContext } from "../context.ts";
import { materialize } from "../expand.ts";
import { generate } from "../generate.ts";
import { tildify } from "../paths.ts";
import { emptySpec } from "../model.ts";
import { loadSpec, saveSpec } from "../store.ts";

export const register = (program: Command, deps: Deps): void => {
  program
    .command("edit")
    .description("Open the aliases file in $VISUAL or $EDITOR, then regenerate")
    .action(() => {
      const { config } = loadContext();
      const editor = process.env["VISUAL"] || process.env["EDITOR"];
      if (!editor) {
        throw new CliError("Neither $VISUAL nor $EDITOR is set");
      }
      if (!existsSync(config.aliasesFile)) {
        saveSpec(config.aliasesFile, emptySpec());
      }
      deps.openEditor(editor, config.aliasesFile);
      const model = materialize(loadSpec(config.aliasesFile)); // validates the edit
      generate(model, config.shells);
      ok(
        `${tildify(config.aliasesFile)}: ${model.rows.length} aliases, regenerated`,
      );
    });
};
