import * as clack from "@clack/prompts";
import { CliError } from "./errors.ts";

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** The interactive surface of dotty, injectable so tests can script answers. */
export interface Prompts {
  text(options: {
    message: string;
    initialValue?: string;
    validate?: (value: string) => string | undefined;
  }): Promise<string>;
  confirm(message: string): Promise<boolean>;
  select<T extends string>(message: string, choices: Choice<T>[]): Promise<T>;
}

const answer = <T>(value: T | symbol): T => {
  if (clack.isCancel(value))
    throw new CliError("Cancelled, nothing was changed");
  return value as T;
};

export const clackPrompts: Prompts = {
  text: async ({ message, initialValue, validate }) =>
    answer<string>(
      await clack.text({
        message,
        ...(initialValue !== undefined ? { initialValue } : {}),
        ...(validate ? { validate: (v) => validate(v ?? "") } : {}),
      }),
    ),
  confirm: async (message) => answer<boolean>(await clack.confirm({ message })),
  select: async (message, choices) =>
    answer<string>(
      await clack.select<string>({
        message,
        options: choices.map((c) => ({
          value: c.value,
          label: c.label,
          ...(c.hint ? { hint: c.hint } : {}),
        })),
      }),
    ) as never,
};
