import { parseArgs } from "node:util";
import { log } from "../lib/shared/log.ts";

const { values } = parseArgs({
  options: {
    name: { type: "string", short: "n", default: "world" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  log(
    "Usage: hello [--name <name>]\n\nOptions:\n  -n, --name <name>  who to greet (default: world)\n  -h, --help         show this help",
  );
} else {
  log(`Hello, ${values.name}!`);
}
