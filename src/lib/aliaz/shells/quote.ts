import type { Shell } from "../paths.ts";

/**
 * The single place that turns text into a shell word. Everything generated
 * goes through here, so quoting bugs are fixable (and testable) in one spot.
 */
export const quote = (text: string, shell: Shell): string =>
  shell === "fish"
    ? `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
    : `'${text.replace(/'/g, `'\\''`)}'`;
