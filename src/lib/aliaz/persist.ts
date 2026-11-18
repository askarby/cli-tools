import type { Config } from "./config.ts";
import { materialize, type Model } from "./expand.ts";
import { generate } from "./generate.ts";
import type { Spec } from "./model.ts";
import { saveSpec } from "./store.ts";

/** Saves the aliases file and regenerates every configured shell's cached file. */
export const persist = (config: Config, spec: Spec): Model => {
  saveSpec(config.aliasesFile, spec);
  const model = materialize(spec);
  generate(model, config.shells);
  return model;
};
