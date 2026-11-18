import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import { ok, say } from "../../shared/ui.ts";
import { loadContext } from "../context.ts";
import { generate } from "../generate.ts";
import { isShell, SHELLS, tildify } from "../paths.ts";
import { render } from "../shells/render.ts";

export const register = (program: Command): void => {
  program
    .command("generate")
    .description("Write the sourceable alias file for a shell")
    .argument(
      "[shell]",
      `one of ${SHELLS.join(", ")} (default: all configured)`,
    )
    .option("--stdout", "print instead of writing (needs a shell)")
    .option("--dry-run", "show what would be written")
    .action(
      (
        shell: string | undefined,
        opts: { stdout?: boolean; dryRun?: boolean },
      ) => {
        const { config, model } = loadContext();
        if (shell !== undefined && !isShell(shell)) {
          throw new CliError(
            `Unknown shell "${shell}"`,
            `Use one of ${SHELLS.join(", ")}`,
          );
        }
        if (opts.stdout) {
          if (shell === undefined) {
            throw new CliError("--stdout needs a shell argument");
          }
          process.stdout.write(render(model, shell));
          return;
        }
        const shells = shell === undefined ? config.shells : [shell];
        for (const r of generate(model, shells, { dryRun: opts.dryRun })) {
          const verb = opts.dryRun ? "Would write" : "Wrote";
          if (r.changed) ok(`${verb} ${tildify(r.file)}`);
          else say(`➖ ${tildify(r.file)} is up to date`);
        }
      },
    );
};
