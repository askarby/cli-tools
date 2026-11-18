import { lstatSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import type { Choice } from "../../shared/prompts.ts";
import { c, hint, ok, say, step, table, warn } from "../../shared/ui.ts";
import type { Deps } from "../cli.ts";
import { findCandidates, NEVER_ADOPT } from "../candidates.ts";
import { loadConfig, type Config } from "../config.ts";
import { assertPackageName, isIgnored, listPackages } from "../packages.ts";
import { expandHome, isInside, normalize, tildify } from "../paths.ts";
import { adoptFile } from "../repo-ops.ts";
import { dryRunNote, plural } from "../ui.ts";

interface Collected {
  files: string[];
  skippedLinks: string[];
}

/** Validates one path the user picked and lists the files under it. */
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
  return { files, skippedLinks };
};

const NEW_PACKAGE = "/new"; // contains a slash, so it can never be a package name

const choosePackage = async (config: Config, deps: Deps): Promise<string> => {
  const existing = listPackages(config);
  let picked = NEW_PACKAGE;
  if (existing.length > 0) {
    const choices: Choice<string>[] = [
      { value: NEW_PACKAGE, label: "➕ New package…" },
      ...existing.map((p) => ({
        value: p.name,
        label: p.name,
        hint: plural(p.entries.length, "file"),
      })),
    ];
    picked = await deps.prompts.select(
      "Which package should the files go in?",
      choices,
    );
  }
  if (picked !== NEW_PACKAGE) return picked;
  const name = (
    await deps.prompts.text({
      message: "New package name (e.g. zsh, git, nvim)",
      validate: (v) => {
        try {
          assertPackageName(v.trim());
          return undefined;
        } catch (e) {
          return (e as Error).message;
        }
      },
    })
  ).trim();
  assertPackageName(name);
  return name;
};

type Action = "add" | "browse" | "remove" | "done";

/** The "basket": every path picked so far, by absolute path. */
type Basket = Map<string, Collected>;

const fillBasket = async (config: Config, deps: Deps): Promise<Basket> => {
  const basket: Basket = new Map();
  const add = (input: string): void => {
    try {
      const abs = normalize(resolve(expandHome(input.trim())));
      basket.set(abs, collect(abs, config));
    } catch (e) {
      if (!(e instanceof CliError)) throw e;
      warn(e.message);
    }
  };
  for (;;) {
    const choices: Choice<Action>[] = [
      { value: "add", label: "Add a path…", hint: "tab completes" },
      { value: "browse", label: "Pick from common dotfiles…" },
    ];
    if (basket.size > 0) {
      choices.push({ value: "remove", label: "Remove something…" });
      choices.push({
        value: "done",
        label: `✅ Done (${plural(basket.size, "path")} picked)`,
      });
    }
    const action = await deps.prompts.select("What next?", choices);
    if (action === "done") return basket;
    if (action === "add") {
      add(
        await deps.prompts.path(
          "Path of a file or directory",
          normalize(config.target),
        ),
      );
    } else if (action === "browse") {
      const candidates = findCandidates(config).filter(
        (cand) => !basket.has(cand.path),
      );
      if (candidates.length === 0) {
        warn("No more common dotfiles to suggest");
        continue;
      }
      const picked = await deps.prompts.multiselect(
        "Pick the ones to adopt",
        candidates.map((cand) => ({
          value: cand.path,
          label: tildify(cand.path),
          hint: cand.group,
        })),
      );
      for (const path of picked) add(path);
    } else {
      const gone = await deps.prompts.multiselect(
        "Which should be left out?",
        [...basket.keys()].map((path) => ({
          value: path,
          label: tildify(path),
        })),
      );
      for (const path of gone) basket.delete(path);
    }
  }
};

interface Opts {
  dryRun?: boolean;
}

export const register = (program: Command, deps: Deps): void => {
  program
    .command("adopt")
    .description(
      "📥 Move files and directories into a package and link them back (interactive)",
    )
    .option("-n, --dry-run", "show what would happen, change nothing")
    .addHelpText(
      "after",
      "\nAlways interactive. Pick a package (existing or new), then add any number of\nfiles or directories, from ~ and ~/.config alike. Files are moved (renamed) into\n<repo>/<package>/ and symlinked back; nothing is copied or deleted. Symlinks\ninside a directory are skipped. Refuses paths under .ssh, .gnupg, .git and\nnode_modules, and packages that already hold the file.",
    )
    .action(async (opts: Opts) => {
      const config = loadConfig();
      if (!deps.isInteractive()) {
        throw new CliError(
          "adopt is interactive: run it in a terminal",
          "To bring in files by hand, move them into <repo>/<package>/ and run `dotty sync`",
        );
      }

      step("Step 1/3: which package?");
      const pkg = await choosePackage(config, deps);

      step("Step 2/3: what do you want to adopt?");
      const basket = await fillBasket(config, deps);

      const live = new Map<string, string>(); // abs file -> rel, de-duplicated
      const skipped = new Set<string>();
      for (const { files, skippedLinks } of basket.values()) {
        for (const f of files)
          live.set(f, relative(normalize(config.target), f));
        for (const l of skippedLinks) skipped.add(l);
      }
      const moves = [...live.entries()]
        .map(([file, rel]) => ({
          live: file,
          rel,
          source: join(config.repo, pkg, rel),
          dest: join(config.target, rel),
        }))
        .sort((a, b) => a.rel.localeCompare(b.rel));
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
      for (const link of skipped) warn(`skipping symlink ${tildify(link)}`);

      step("Step 3/3: review");
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
      const go = await deps.prompts.confirm(
        `Move ${plural(moves.length, "file")} into ${tildify(config.repo)}/${pkg} and link back?`,
      );
      if (!go) throw new CliError("Cancelled, nothing was changed");

      let done = 0;
      try {
        for (const m of moves) {
          adoptFile(m.live, m.source);
          done++;
        }
      } catch (e) {
        if (done > 0)
          warn(
            `${plural(done, "file")} were adopted before the error; the rest were left alone`,
          );
        throw e;
      }
      ok(`Adopted ${plural(moves.length, "file")} into ${c.bold(pkg)}`);
      hint(`Commit it: git -C ${tildify(config.repo)} add ${pkg}`);
    });
};
