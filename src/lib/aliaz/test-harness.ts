import { join } from "node:path";
import { vi } from "vitest";
import {
  createHarness as createBaseHarness,
  fakePrompts,
  type Harness as BaseHarness,
} from "../shared/test-harness.ts";
import { run, type Deps } from "./cli.ts";

export { fakePrompts, type FakePrompts } from "../shared/test-harness.ts";

export interface Harness extends BaseHarness<Deps> {
  aliasesFile: string;
  /** Path of the generated file for a shell. */
  generated: (shell: string) => string;
  /** Writes aliases.toml. */
  aliases: (toml: string) => void;
}

/** aliaz's harness: sandboxed config/state dirs, and (optionally) a config.toml. */
export const createHarness = (withConfig = true): Harness => {
  let aliasesFile = "";
  let state = "";
  const base = createBaseHarness<Deps>({
    run,
    defaultDeps: () => ({
      prompts: fakePrompts([]),
      isInteractive: () => false,
      openEditor: () => {},
    }),
    setup: (h) => {
      state = join(h.home, ".local", "state");
      vi.stubEnv("XDG_STATE_HOME", state);
      aliasesFile = join(h.home, ".config", "aliaz", "aliases.toml");
      if (withConfig) {
        h.write(
          join(h.home, ".config", "aliaz", "config.toml"),
          `shells = ["zsh", "bash", "fish"]\n`,
        );
      }
    },
  });
  return {
    ...base,
    aliasesFile,
    generated: (shell) => join(state, "aliaz", `aliases.${shell}`),
    aliases: (toml) => void base.write(aliasesFile, toml),
  };
};
