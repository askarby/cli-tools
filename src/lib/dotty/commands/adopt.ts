import { lstatSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import { c, hint, ok, say, step, table, warn } from "../../shared/ui.ts";
import type { Deps } from "../cli.ts";
import { loadConfig, type Config } from "../config.ts";
import { assertPackageName, isIgnored } from "../packages.ts";
import { expandHome, isInside, normalize, tildify } from "../paths.ts";
import { adoptFile } from "../repo-ops.ts";
import { dryRunNote, plural } from "../ui.ts";

const NEVER_ADOPT = [".git", ".ssh", ".gnupg", "node_modules"];

export const suggestPackage = (rel: string): string => {
  const [first, second] = rel.split(sep);
  const base = first === ".config" && second ? second : (first ?? "");
  return base.replace(/^\./, "").replace(/\.[^.]*$/, "") || "dotfiles";
};

interface Collected {
  base: string;
  files: string[];
  skippedLinks: string[];
}

const collect = (input: string, config: Config): Collected => {
  const abs = normalize(resolve(expandHome(input)));
  let stat;
  try {
    stat = lstatSync(abs);
  } catch {
    throw new CliError(`Not found: ${tildify(abs)}`);
  }
  if (stat.isSymbolicLink()) {
    throw new CliError(
      `${tildify(abs)} is already a symlink: nothing to adopt`,
    );
  }
  const target = normalize(config.target);
  if (!isInside(abs, target)) {
    throw new CliError(`${tildify(abs)} is not inside ${tildify(target)}`);
  }
  if (isInside(abs, normalize(config.repo)) || abs === normalize(config.repo)) {
    throw new CliError("That path is inside the dotfiles repo already");
  }
  const blocked = relative(target, abs)
    .split(sep)
    .find((p) => NEVER_ADOPT.includes(p));
  if (blocked) {
    throw new CliError(
      `Refusing to adopt anything under ${blocked}`,
      "Adopt individual safe files by hand",
    );
  }
  const files: string[] = [];
  const skippedLinks: string[] = [];
  const walk = (path: string): void => {
    for (const dirent of readdirSync(path, { withFileTypes: true })) {
      if (isIgnored(dirent.name, config.ignore)) continue;
      const child = join(path, dirent.name);
      if (dirent.isSymbolicLink()) skippedLinks.push(child);
      else if (dirent.isDirectory()) walk(child);
      else files.push(child);
    }
  };
  if (stat.isDirectory()) walk(abs);
  else files.push(abs);
  if (files.length === 0)
    throw new CliError(`Nothing to adopt in ${tildify(abs)}`);
  return { base: abs, files, skippedLinks };
};

interface Opts {
  package?: string;
  yes?: boolean;
  dryRun?: boolean;
}

export const register = (program: Command, deps: Deps): void => {
  program
    .command("adopt")
    .description(
      "📥 Move a file or directory into the repo and link it back (guided)",
    )
    .argument("[path]", "file or directory under the target to adopt")
    .option("-p, --package <name>", "package to put it in (skips the question)")
    .option("-y, --yes", "don't ask for confirmation")
    .option("-n, --dry-run", "show what would happen, change nothing")
    .addHelpText(
      "after",
      "\nFiles are moved (renamed) into <repo>/<package>/ and symlinked back; nothing is\ncopied or deleted. Symlinks inside a directory are skipped. Refuses paths under\n.ssh, .gnupg, .git and node_modules, and packages that already hold the file.",
    )
    .action(async (pathArg: string | undefined, opts: Opts) => {
      const config = loadConfig();
      const interactive = deps.isInteractive();
      if (pathArg === undefined && !interactive) {
        throw new CliError("Pass a path when not run interactively");
      }
      if (opts.package === undefined && !interactive) {
        throw new CliError("Pass --package <name> when not run interactively");
      }

      if (interactive) step("Step 1/3: what do you want to adopt?");
      const input =
        pathArg ??
        (await deps.prompts.text({
          message: "Path of the file or directory (e.g. ~/.config/nvim)",
          validate: (v) => (v.trim() ? undefined : "Enter a path"),
        }));
      const { base, files, skippedLinks } = collect(input.trim(), config);

      if (interactive && opts.package === undefined)
        step("Step 2/3: which package?");
      const name =
        opts.package ??
        (await deps.prompts.text({
          message: "Package name",
          initialValue: suggestPackage(
            relative(normalize(config.target), base),
          ),
          validate: (v) => {
            try {
              assertPackageName(v.trim());
              return undefined;
            } catch (e) {
              return (e as Error).message;
            }
          },
        }));
      const pkg = name.trim();
      assertPackageName(pkg);

      const moves = files.map((live) => {
        const rel = relative(normalize(config.target), live);
        return {
          live,
          rel,
          source: join(config.repo, pkg, rel),
          dest: join(config.target, rel),
        };
      });
      const clashes = moves.filter((m) => {
        try {
          lstatSync(m.source);
          return true;
        } catch {
          return false;
        }
      });
      if (clashes.length > 0) {
        throw new CliError(
          `${plural(clashes.length, "file")} already exist in package '${pkg}'`,
          `Use \`dotty sync ${pkg}\` to reconcile, or pick another package. First: ${clashes[0]?.rel}`,
        );
      }
      for (const link of skippedLinks)
        warn(`skipping symlink ${tildify(link)}`);

      if (interactive) step("Step 3/3: review");
      table(
        ["PACKAGE", "ACTION", "PATH"],
        moves.map((m) => [
          c.bold(pkg),
          `📥 ${c.green("adopt")}`,
          tildify(m.dest),
        ]),
      );
      say();
      if (opts.dryRun) return dryRunNote();
      if (!opts.yes) {
        if (!interactive)
          throw new CliError(
            "Refusing to continue without --yes (not interactive)",
          );
        const go = await deps.prompts.confirm(
          `Move ${plural(moves.length, "file")} into ${tildify(config.repo)}/${pkg} and link back?`,
        );
        if (!go) throw new CliError("Cancelled, nothing was changed");
      }
      for (const m of moves) adoptFile(m.live, m.source);
      ok(`Adopted ${plural(moves.length, "file")} into ${c.bold(pkg)}`);
      hint(`Commit it: git -C ${tildify(config.repo)} add ${pkg}`);
    });
};
