import {
  mkdirSync,
  mkdtempSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MANAGED_MARKER, safeRemove } from "./safety.ts";

export interface Sandbox {
  /** Throwaway directory (never the real home). Contains the managed marker. */
  dir: string;
  /** Subdirectory for the files under test. */
  work: string;
  /** Remove everything the test created. Call from `afterEach`. */
  cleanup: () => void;
}

/**
 * Create a temp directory for a test. The tree is removed through
 * `safeRemove`, so even a broken test can only delete inside its own sandbox.
 */
export const createSandbox = (): Sandbox => {
  const dir = mkdtempSync(join(tmpdir(), "cli-tools-"));
  const marker = join(dir, MANAGED_MARKER);
  writeFileSync(marker, "");
  const work = join(dir, "work");
  mkdirSync(work);
  return {
    dir,
    work,
    cleanup: () => {
      safeRemove(work, { root: dir });
      // Only the marker is left. unlink + non-recursive rmdir can't touch anything else.
      unlinkSync(marker);
      rmdirSync(dir);
    },
  };
};
