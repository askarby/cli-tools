# cli-tools

A collection of small TypeScript command-line tools for my personal development machines. Each tool is a plain TypeScript file run directly with [tsx](https://tsx.is), so there is no build step, and each one is started through a thin bash launcher on your `PATH`.

## Getting started

You need:

- [Node.js](https://nodejs.org) 22 or newer (the repo pins 24.11.1 in `.tool-versions` for [asdf](https://asdf-vm.com))
- npm (ships with Node.js)
- bash, and `~/.bin` on your `PATH`

Then:

```sh
git clone <this repo> && cd cli-tools
./install.sh
```

`install.sh` installs the dependencies (`npm install`, skipped if already done) and symlinks every launcher in `bin/` into `~/.bin`. It is safe to run again, and it never deletes anything: conflicts and dead links are reported with a suggestion, for you to act on.

Check that it worked by running any tool with `--help`, for example `aliaz --help`.

## Tools

Every tool documents its commands and options in its own `--help`; the pages below explain what each tool is for.

| Tool                                         | What it is                                |
| -------------------------------------------- | ----------------------------------------- |
| [herdrinator](src/lib/herdrinator/README.md) | tmuxinator-style workspaces for herdr     |
| [dotty](src/lib/dotty/README.md)             | a stow-style dotfiles manager             |
| [aliaz](src/lib/aliaz/README.md)             | manage, search and generate shell aliases |

<!-- tools:end -->

## More

- [CONTRIBUTING.md](CONTRIBUTING.md): how to contribute, and the tooling behind the repo
- [LLM.md](LLM.md): how AI is used in this repo
