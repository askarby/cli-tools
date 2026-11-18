import type { Alias } from "./model.ts";

const isSubsequence = (needle: string, haystack: string): boolean => {
  let i = 0;
  for (const ch of haystack) if (ch === needle[i]) i += 1;
  return i === needle.length;
};

/** Score of one term against an alias; 0 means no match. */
const termScore = (alias: Alias, term: string): number => {
  const name = alias.name.toLowerCase();
  if (name === term) return 100;
  if (name.startsWith(term)) return 80;
  if (name.includes(term)) return 60;
  if (alias.description.toLowerCase().includes(term)) return 30;
  if (alias.command.toLowerCase().includes(term)) return 20;
  return term.length > 2 && isSubsequence(term, name) ? 10 : 0;
};

/** Aliases matching every term (name > description > command), best first. */
export const search = (aliases: Alias[], query: string): Alias[] => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return aliases
    .map((alias) => {
      const scores = terms.map((t) => termScore(alias, t));
      const total = scores.every((s) => s > 0)
        ? scores.reduce((a, b) => a + b, 0)
        : 0;
      return { alias, total };
    })
    .filter((m) => m.total > 0)
    .sort(
      (a, b) => b.total - a.total || a.alias.name.localeCompare(b.alias.name),
    )
    .map((m) => m.alias);
};

/** Wraps case-insensitive occurrences of any term with `mark`. */
export const highlight = (
  text: string,
  query: string,
  mark: (s: string) => string,
): string => {
  const terms = query
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (terms.length === 0) return text;
  return text.replace(new RegExp(terms.join("|"), "gi"), mark);
};
