import { mkdirSync, renameSync, symlinkSync } from "node:fs";
import { dirname } from "node:path";
import { CliError } from "../shared/errors.ts";
import { tildify } from "./paths.ts";

/**
 * Moves a live file into the repo (replacing the repo's copy, if any) and
 * links it back. Only ever renames: a cross-device move is refused rather
 * than turned into copy + delete.
 */
export const adoptFile = (live: string, source: string): void => {
  mkdirSync(dirname(source), { recursive: true });
  try {
    renameSync(live, source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EXDEV") {
      throw new CliError(
        `Cannot move ${tildify(live)} into the repo: it is on a different filesystem`,
        "Copy it into the repo by hand, then run `dotty sync`",
      );
    }
    throw error;
  }
  symlinkSync(source, live);
};
