import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import type { Command } from "commander";
import { CliError } from "../../shared/errors.ts";
import { c, hint, ok, say, table } from "../../shared/ui.ts";
import type { Deps } from "../cli.ts";
import { loadConfig, type Config } from "../config.ts";
import { inspectEntry } from "../inspect.ts";
import {
  isIgnored,
  listPackages,
  selectPackages,
  type Pkg,
} from "../packages.ts";
import { tildify } from "../paths.ts";
import { adoptFile } from "../repo-ops.ts";
import { dryRunNote, plural } from "../ui.ts";

type Kind = "identical" | "changed" | "new";

interface Finding {
  pkg: string;
  kind: Kind;
  live: string;
  source: string;
}

const isRealFile = (path: string): boolean => {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
};

const isRealDir = (path: string): boolean => {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
};

/**
 * Directories that are scanned for new files: those holding package files,
 * at least two levels below the target (so `~/.config` itself is never scanned).
 */
const ownedDirs = (pkg: Pkg): string[] => [
  ...new Set(
    pkg.entries
      .map((e) => dirname(e.rel))
      .filter((d) => d.split(sep).length >= 2),
  ),
];

const findings = (pkgs: Pkg[], config: Config): Finding[] => {
  const found: Finding[] = [];
  for (const pkg of pkgs) {
    const known = new Set(pkg.entries.map((e) => e.rel));
    for (const entry of pkg.entries) {
      const i = inspectEntry(entry, config.target);
      if (i.state !== "conflict" || !isRealFile(i.dest)) continue;
      const same = readFileSync(i.dest).equals(readFileSync(entry.source));
      found.push({
        pkg: pkg.name,
        kind: same ? "identical" : "changed",
        live: i.dest,
        source: entry.source,
      });
    }
    for (const rel of ownedDirs(pkg)) {
      const dir = join(config.target, rel);
      if (!isRealDir(dir)) continue;
      for (const dirent of readdirSync(dir, { withFileTypes: true })) {
        const childRel = join(rel, dirent.name);
        if (
          !dirent.isFile() ||
          known.has(childRel) ||
          isIgnored(dirent.name, config.ignore)
        )
          continue;
        found.push({
          pkg: pkg.name,
          kind: "new",
          live: join(dir, dirent.name),
          source: join(pkg.dir, childRel),
        });
      }
    }
  }
  return found;
};

const label = (kind: Kind): string =>
  kind === "identical"
    ? `🟰 ${c.gray("identical")}`
    : kind === "changed"
      ? `✏️  ${c.yellow("changed")}`
      : `🆕 ${c.cyan("new")}`;

interface Opts {
  yes?: boolean;
  dryRun?: boolean;
}

export const register = (program: Command, deps: Deps): void => {
  program
    .command("sync")
    .description("Pull live changes and new files back into the repo")
    .argument("[packages...]", "packages to sync (default: all)")
    .option("-y, --yes", "accept every change without asking")
    .option("-n, --dry-run", "show what would happen, change nothing")
    .addHelpText(
      "after",
      "\nFinds real files where a link should be (changed/identical) and new files in\nfolders a package already owns (at least two levels deep, so ~/.config itself\nis never scanned).",
    )
    .action(async (names: string[], opts: Opts) => {
      const config = loadConfig();
      if (!opts.yes && !opts.dryRun && !deps.isInteractive()) {
        throw new CliError(
          "Refusing to continue without --yes (not interactive)",
        );
      }
      const pkgs =
        names.length > 0
          ? selectPackages(config, names, false)
          : listPackages(config);
      const list = findings(pkgs, config);
      if (list.length === 0) return ok("Everything is in sync");
      table(
        ["PACKAGE", "CHANGE", "PATH"],
        list.map((f) => [c.bold(f.pkg), label(f.kind), tildify(f.live)]),
      );
      say();
      if (opts.dryRun) return dryRunNote();
      let done = 0;
      for (const f of list) {
        const accept =
          f.kind === "identical" ||
          opts.yes ||
          (f.kind === "changed"
            ? (await deps.prompts.select(
                `${tildify(f.live)} differs from the repo`,
                [
                  {
                    value: "take",
                    label: "Take the live version into the repo",
                  },
                  {
                    value: "skip",
                    label: "Skip",
                    hint: "leave both as they are",
                  },
                ],
              )) === "take"
            : await deps.prompts.confirm(
                `Adopt ${tildify(f.live)} into ${f.pkg}?`,
              ));
        if (!accept) continue;
        adoptFile(f.live, f.source);
        done++;
      }
      ok(`Synced ${plural(done, "file")} (${list.length - done} skipped)`);
      if (done > 0) hint(`Review with: git -C ${tildify(config.repo)} diff`);
    });
};
