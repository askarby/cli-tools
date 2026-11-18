import { Command } from "commander";
import { CliError } from "./errors.ts";
import { c, say } from "./ui.ts";

/** What differs between tools; everything else about the commander setup is shared. */
export interface CliSpec<D> {
  /** Program name, as typed in the shell. */
  name: string;
  /** One-line description, usually starting with an emoji. */
  description: string;
  /** Text printed after the help (examples, notes). */
  helpText?: string;
  /** One `register(program, deps)` per subcommand. */
  registrars: ((program: Command, deps: D) => void)[];
}

/** Builds the styled commander program with every subcommand registered. */
export const buildProgram = <D>(spec: CliSpec<D>, deps: D): Command => {
  const program = new Command(spec.name)
    .description(spec.description)
    .helpOption("-h, --help", "show this help")
    .showHelpAfterError(`(run \`${spec.name} --help\` for usage)`)
    .configureHelp({
      styleTitle: (title) => c.bold(title),
      styleCommandText: (text) => c.cyan(text),
      styleSubcommandText: (text) => c.cyan(text),
      styleOptionText: (text) => c.green(text),
      styleArgumentText: (text) => c.yellow(text),
    })
    .exitOverride();
  if (spec.helpText) program.addHelpText("after", spec.helpText);
  for (const register of spec.registrars) register(program, deps);
  return program;
};

/**
 * Runs a tool: maps `-?` to `--help`, prints help without arguments, and turns
 * expected failures into `❌ message` (+ `💡 hint`) with exit code 1.
 * `CliError`, `SafetyError` and commander's own exits are handled; anything
 * else is a bug and is rethrown.
 */
export const runCli = async <D>(
  spec: CliSpec<D>,
  argv: string[],
  deps: D,
): Promise<void> => {
  const args = argv.map((arg) => (arg === "-?" ? "--help" : arg));
  const program = buildProgram(spec, deps);
  if (args.length === 0) {
    program.outputHelp();
    return;
  }
  try {
    await program.parseAsync(args, { from: "user" });
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`❌ ${error.message}`);
      if (error.hint) say(`💡 ${c.dim(error.hint)}`);
      process.exitCode = 1;
      return;
    }
    if (error instanceof Error && error.name === "SafetyError") {
      console.error(`❌ ${error.message}`);
      process.exitCode = 1;
      return;
    }
    const code = (error as { code?: string }).code;
    if (code?.startsWith("commander.")) {
      process.exitCode = (error as { exitCode: number }).exitCode;
      return;
    }
    throw error;
  }
};
