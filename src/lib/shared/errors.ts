/** An expected, user-facing failure. Printed without a stack trace. */
export class CliError extends Error {
  readonly hint: string | undefined;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "CliError";
    this.hint = hint;
  }
}
