import { styleText } from "node:util";

type Style = Parameters<typeof styleText>[0];

const paint =
  (style: Style) =>
  (text: string): string =>
    styleText(style, text);

export const c = {
  green: paint("green"),
  red: paint("red"),
  yellow: paint("yellow"),
  cyan: paint("cyan"),
  gray: paint("gray"),
  bold: paint("bold"),
  dim: paint("dim"),
};

export const say = (message = ""): void => console.log(message);
export const ok = (message: string): void => say(`✅ ${message}`);
export const warn = (message: string): void =>
  console.error(`⚠️  ${c.yellow(message)}`);
export const hint = (message: string): void => say(`💡 ${c.dim(message)}`);
export const step = (message: string): void => say(`${c.cyan("›")} ${message}`);

const ANSI = /\u001b\[[0-9;]*m/g;

/** Terminal column width: strips colours, counts emoji as two columns. */
export const displayWidth = (text: string): number =>
  [...text.replace(ANSI, "").replace(/️/g, "")].reduce(
    (width, char) => width + (/\p{Extended_Pictographic}/u.test(char) ? 2 : 1),
    0,
  );

const pad = (text: string, width: number): string =>
  text + " ".repeat(Math.max(0, width - displayWidth(text)));

/** Prints rows as a column-aligned table with a bold header. */
export const table = (header: string[], rows: string[][]): void => {
  const widths = header.map((title, index) =>
    Math.max(
      displayWidth(title),
      ...rows.map((row) => displayWidth(row[index] ?? "")),
    ),
  );
  const line = (cells: string[]): string =>
    cells
      .map((cell, index) => pad(cell, widths[index] ?? 0))
      .join("  ")
      .trimEnd();
  say(c.bold(line(header)));
  say(c.gray(widths.map((width) => "─".repeat(width)).join("  ")));
  for (const row of rows) say(line(row));
};
