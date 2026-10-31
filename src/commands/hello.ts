import { parseArgs } from "node:util";
import { log } from "../lib/log.ts";

const { values } = parseArgs({
  options: { name: { type: "string", short: "n", default: "world" } },
});

log(`Hello, ${values.name}!`);
