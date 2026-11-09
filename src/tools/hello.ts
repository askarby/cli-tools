import { parseArgs } from "node:util";
import { log } from "../lib/shared/log.ts";

const { values } = parseArgs({
  options: { name: { type: "string", short: "n", default: "world" } },
});

log(`Hello, ${values.name}!`);
