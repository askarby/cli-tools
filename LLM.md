# Using AI in this repo

This repo is developed with the help of AI coding agents (mainly [Claude Code](https://claude.com/claude-code)). This page is a very high-level description of how; the details are in the files it links to.

## How it is set up

- [`AGENTS.md`](AGENTS.md) is the entry point every agent reads: stack, commands, layout and the hard rules.
- `.agents/skills/<name>/SKILL.md` holds task-specific guidance (adding a tool, TypeScript conventions, testing, safety, and so on). They are also exposed to Claude Code through `.claude/skills`.
- `src/lib/<tool>/AGENTS.md` holds the notes for working on one tool.

## The usual flow

1. Describe the change, and let the agent read the relevant skills and code.
2. Agree on a plan for anything larger than a small fix.
3. The agent implements it, with tests.
4. `npm run check` must pass: it is the same check CI runs.
5. A human reviews the result and decides what gets committed. Agents do not commit unless asked.

## Guardrails

- The `safety` skill and `safeRemove`/`safeUnlink` keep any code that deletes or overwrites within bounds.
- Tests run in sandboxes, never against real configuration.
- Conventions are enforced by tests and lint where possible (for example, `cli-docs.test.ts` and `tool-independence.test.ts`), not just by instructions.
- New runtime dependencies need a human decision.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the human-facing version of the rules.
