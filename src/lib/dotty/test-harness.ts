import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createHarness as createBaseHarness,
  fakePrompts,
  type Harness as BaseHarness,
} from "../shared/test-harness.ts";
import { run, type Deps } from "./cli.ts";

export { fakePrompts, type FakePrompts } from "../shared/test-harness.ts";

export interface Harness extends BaseHarness<Deps> {
  repo: string;
  /** Writes a file relative to the repo (`pkg/path`). */
  repoFile: (rel: string, content?: string) => string;
  /** Runs dotty in-process (alias of `cli`). */
  dotty: BaseHarness<Deps>["cli"];
}

/** dotty's harness: the shared one plus a repo directory and a config.toml pointing at it. */
export const createHarness = (withConfig = true): Harness => {
  let repo = "";
  const base = createBaseHarness<Deps>({
    run,
    defaultDeps: () => ({
      prompts: fakePrompts([]),
      isInteractive: () => false,
    }),
    setup: (h) => {
      repo = join(h.work, "repo");
      mkdirSync(repo, { recursive: true });
      if (withConfig) {
        h.write(
          join(h.home, ".config", "dotty", "config.toml"),
          `repo = "${repo}"\nignore = ["README*"]\n`,
        );
      }
    },
  });
  return {
    ...base,
    repo,
    repoFile: (rel, content = "repo") => base.write(join(repo, rel), content),
    dotty: base.cli,
  };
};
