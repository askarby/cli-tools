import { Command } from "commander";
import { CliError } from "./errors.ts";
import { c, say } from "./ui.ts";
import { register as action } from "./commands/action.ts";
import { register as doctor } from "./commands/doctor.ts";
import { register as edit } from "./commands/edit.ts";
import { register as list } from "./commands/list.ts";
import { register as newWorkspace } from "./commands/new.ts";
import { register as setup } from "./commands/setup.ts";
import { register as start } from "./commands/start.ts";
import { register as stop } from "./commands/stop.ts";

const EXAMPLES = `
${c.bold("Examples:")}
  herdrinator setup                           ${c.gray("create the config file and an example workspace")}
  herdrinator new bob                         ${c.gray("create bob.yml")}
  herdrinator start bob                       ${c.gray("build (or focus) the 'bob' workspace")}
  herdrinator list                            ${c.gray("show which workspaces are running")}
  herdrinator action w "CLI Tools"            ${c.gray("script: create a workspace")}
  herdrinator action t "claude ." --name Claude  ${c.gray("script: add a tab to the active workspace")}
`;

const REGISTRARS = [
  start,
  newWorkspace,
  setup,
  list,
  edit,
  stop,
  doctor,
  action,
];

export const buildProgram = (): Command => {
  const program = new Command("herdrinator")
    .description("🐑 tmuxinator-style workspaces for herdr")
    .helpOption("-h, --help", "show this help")
    .showHelpAfterError("(run `herdrinator --help` for usage)")
    .configureHelp({
      styleTitle: (title) => c.bold(title),
      styleCommandText: (text) => c.cyan(text),
      styleSubcommandText: (text) => c.cyan(text),
      styleOptionText: (text) => c.green(text),
      styleArgumentText: (text) => c.yellow(text),
    })
    .addHelpText("after", EXAMPLES)
    .exitOverride();
  for (const register of REGISTRARS) register(program);
  return program;
};

export const run = async (argv: string[]): Promise<void> => {
  const args = argv.map((arg) => (arg === "-?" ? "--help" : arg));
  const program = buildProgram();
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
    const code = (error as { code?: string; exitCode?: number }).code;
    if (code?.startsWith("commander.")) {
      process.exitCode = (error as { exitCode: number }).exitCode;
      return;
    }
    throw error;
  }
};
