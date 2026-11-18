import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute } from "node:path";
import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import { c, hint, ok, say } from "../../shared/ui.ts";
import type { Deps } from "../cli.ts";
import { writeConfig } from "../config.ts";
import { configPath, expandHome, tildify } from "../paths.ts";

export const register = (program: Command, deps: Deps): void => {
  program
    .command("init")
    .description("Create the config file pointing at your dotfiles repo")
    .option("-r, --repo <path>", "local path of the dotfiles repository")
    .option("-t, --target <dir>", "directory to link into (default: $HOME)")
    .action(async (opts: { repo?: string; target?: string }) => {
      if (existsSync(configPath())) {
        throw new CliError(
          `${tildify(configPath())} already exists`,
          "Edit it by hand; dotty init never overwrites",
        );
      }
      let repo = opts.repo;
      if (repo === undefined) {
        if (!deps.isInteractive()) {
          throw new CliError("Pass --repo <path> when not run interactively");
        }
        repo = await deps.prompts.text({
          message: "Where is your dotfiles repository?",
          initialValue: "~/dotfiles",
          validate: (v) =>
            isAbsolute(expandHome(v.trim()))
              ? undefined
              : "Use an absolute path or start with ~/",
        });
      }
      repo = repo.trim();
      if (!isAbsolute(expandHome(repo))) {
        throw new CliError(
          `--repo must be absolute or start with ~/ (got "${repo}")`,
        );
      }
      const { file } = writeConfig(repo, opts.target);
      ok(`Wrote ${c.bold(tildify(file))}`);
      const dir = expandHome(repo);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        say(`📁 Created ${c.bold(tildify(dir))}`);
      }
      hint(
        "Put packages in the repo (e.g. zsh/.zshrc), then run `dotty link --all`",
      );
    });
};
