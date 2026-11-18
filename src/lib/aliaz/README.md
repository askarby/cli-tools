# aliaz

A shell alias manager. Aliases live in one TOML file, grouped and with descriptions, so they are easy to find with `list` and `search`. `aliaz` turns that file into a sourceable file for sh, bash, zsh and fish.

## Where things live

- Aliases: `$XDG_CONFIG_HOME/aliaz/aliases.toml`
- Config (optional): `$XDG_CONFIG_HOME/aliaz/config.toml`
- Generated files: `$XDG_STATE_HOME/aliaz/`, which you source from your shell rc. `aliaz` never runs at shell start, so startup stays fast.

## Usage

Run `aliaz init` to get started, then see `aliaz --help` (and `aliaz <command> --help`) for everything else, including the alias, directory rule and function formats.
