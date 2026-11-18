import { loadConfig, type Config } from "./config.ts";
import { materialize, type Model } from "./expand.ts";
import type { Spec } from "./model.ts";
import { loadSpec } from "./store.ts";

export interface Context {
  config: Config;
  /** The aliases file as written. */
  spec: Spec;
  /** The spec resolved against the disk (expanded aliases, problems). */
  model: Model;
}

/** Config plus the parsed aliases file: what almost every command needs. */
export const loadContext = (): Context => {
  const config = loadConfig();
  const spec = loadSpec(config.aliasesFile);
  return { config, spec, model: materialize(spec) };
};
