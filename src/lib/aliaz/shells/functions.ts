import { applyTemplate } from "../expand.ts";
import type { FunctionRule } from "../model.ts";
import type { Shell } from "../paths.ts";
import { quote } from "./quote.ts";

/** Test operator for the entry: `-d` dirs, `-f` files, `-e` anything. */
const testFlag = (f: FunctionRule): string =>
  f.dirsOnly ? "-d" : f.filesOnly ? "-f" : "-e";

const ident = (name: string): string => name.replace(/[^A-Za-z0-9_]/g, "_");

const posixFunction = (f: FunctionRule): string[] => {
  const body = applyTemplate(f.command, '"$entry"', f.dir);
  return [
    `${f.name}() {`,
    `  local entry="$1"`,
    `  case "$entry" in`,
    `    ""|*/*|.*) echo "usage: ${f.name} <entry>" >&2; return 1 ;;`,
    `  esac`,
    `  [ ${testFlag(f)} ${f.dir}/"$entry" ] || { echo "${f.name}: no such entry: $entry" >&2; return 1; }`,
    `  shift`,
    `  ${body} "$@"`,
    `}`,
  ];
};

const fishFunction = (f: FunctionRule): string[] => {
  const body = applyTemplate(f.command, '"$entry"', f.dir);
  const flag = f.dirsOnly ? "-d" : f.filesOnly ? "-f" : "-e";
  return [
    `function ${f.name} --description ${quote(f.description || f.name, "fish")}`,
    `  set -l entry $argv[1]`,
    `  switch "$entry"`,
    `    case '' '*/*' '.*'`,
    `      echo "usage: ${f.name} <entry>" >&2; return 1`,
    `  end`,
    `  test ${flag} ${f.dir}/"$entry"; or begin; echo "${f.name}: no such entry: $entry" >&2; return 1; end`,
    `  set -e argv[1]`,
    `  ${body} $argv`,
    `end`,
  ];
};

const bashCompletion = (f: FunctionRule): string[] => {
  const fn = `_aliaz_${ident(f.name)}`;
  const kind = f.dirsOnly ? "-d" : "-f";
  return [
    `${fn}() {`,
    `  [ "$COMP_CWORD" -eq 1 ] || return 0`,
    `  COMPREPLY=( $(cd ${f.dir} 2>/dev/null && compgen ${kind} -- "\${COMP_WORDS[COMP_CWORD]}") )`,
    `}`,
    `complete -F ${fn} ${f.name}`,
  ];
};

const zshCompletion = (f: FunctionRule): string[] => {
  const fn = `_aliaz_${ident(f.name)}`;
  const qualifier = f.dirsOnly ? "(N/:t)" : f.filesOnly ? "(N.:t)" : "(N:t)";
  return [
    `${fn}() {`,
    `  [[ $CURRENT -eq 2 ]] || return 0`,
    `  local -a entries`,
    `  entries=(${f.dir}/*${qualifier})`,
    `  compadd -a entries`,
    `}`,
    `(( $+functions[compdef] )) && compdef ${fn} ${f.name}`,
  ];
};

const fishCompletion = (f: FunctionRule): string[] => {
  const filter = f.dirsOnly
    ? ` | string match -r '.*/$' | string trim -c /`
    : f.filesOnly
      ? ` | string match -rv '/$'`
      : ` | string trim -c /`;
  return [
    `complete -c ${f.name} -f -n '__fish_is_first_arg' -a '(command ls -1p ${f.dir} 2>/dev/null${filter})'`,
  ];
};

/** The function plus (where the shell supports it) tab completion. */
export const renderFunction = (f: FunctionRule, shell: Shell): string[] => {
  switch (shell) {
    case "fish":
      return [...fishFunction(f), ...fishCompletion(f)];
    case "zsh":
      return [...posixFunction(f), ...zshCompletion(f)];
    case "bash":
      return [...posixFunction(f), ...bashCompletion(f)];
    case "sh":
      return posixFunction(f);
  }
};
