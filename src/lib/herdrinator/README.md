# herdrinator

tmuxinator-style workspaces for [herdr](https://herdr.dev). Describe a workspace once in a YAML file (the tmuxinator format: windows become tabs, panes become splits) and `herdrinator start` builds it, or focuses it if it is already running.

## Requirements

- `herdr` on your `PATH`

## Where things live

- Config: `$XDG_CONFIG_HOME/herdrinator/herdrinatorrc.toml`
- Workspaces: `$XDG_CONFIG_HOME/herdrinator/workspaces/<name>.yml`

## Usage

Run `herdrinator setup` to create the config and an example workspace, then see `herdrinator --help` (and `herdrinator <command> --help`) for everything else. `herdrinator doctor` checks that herdr, the config and your workspace files are in order.
