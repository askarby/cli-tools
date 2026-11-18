# dotty

A stow-style dotfiles manager. It does not use stow. Your dotfiles repo is a set of _packages_, laid out as `<repo>/<package>/<path as seen from $HOME>` (for example `zsh/.zshrc` or `nvim/.config/nvim/init.lua`), and `dotty` symlinks them into place.

## Where things live

- Config: `$XDG_CONFIG_HOME/dotty/config.toml`, pointing at your repo (`repo` is required)

## Usage

Run `dotty init --repo <path>` to create the config, then see `dotty --help` (and `dotty <command> --help`) for everything else. The help text also lists the safety guarantees: conflicts are never overwritten, nothing is ever deleted, and every command that changes things supports `--dry-run`.
