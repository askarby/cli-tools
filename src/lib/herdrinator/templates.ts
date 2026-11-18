export const rcTemplate = (
  workspacesDir: string,
): string => `# herdrinatorrc.toml - configuration for herdrinator
#
# Location: $XDG_CONFIG_HOME/herdrinator/herdrinatorrc.toml
#           (XDG_CONFIG_HOME defaults to ~/.config)
#
# Every setting is optional; the values below are the defaults.

# Directory holding your workspace files (<name>.yml). \`herdrinator start bob\`
# looks for bob.yml (then bob.yaml) here, and \`herdrinator new bob\` creates it here.
# A leading ~ is expanded to your home directory.
workspaces_dir = "${workspacesDir}"

# Extra directories to search after workspaces_dir (first match wins).
# Handy for sharing workspace files between machines or keeping some in a repo.
# extra_dirs = ["~/shared/herdrinator", "~/work/workspaces"]

# Editor used by \`herdrinator edit <name>\`. When empty, $VISUAL and then
# $EDITOR are used. Arguments are allowed, e.g. "code --wait".
editor = ""

[defaults]
# Focus the workspace in herdr once \`start\` has built it.
# Override per run with --no-focus.
focus = true
`;

export const exampleWorkspace = (
  name: string,
): string => `# ${name}.yml - a herdrinator workspace (tmuxinator-compatible format)
#
# Start it with:  herdrinator start ${name}
#
# Mapping to herdr: a tmuxinator "window" becomes a herdr tab, a "pane" becomes
# a split inside that tab, and the project becomes a herdr workspace.

# Workspace label shown in herdr. Also how \`herdrinator list\` knows it is running.
name: ${name}

# Working directory for every tab and pane (unless a window overrides it).
root: ~/Projects/${name}

# Optional: local commands run once, in \`root\`, before the workspace is built.
# on_project_start: git fetch --quiet

# Optional: commands typed into EVERY pane before its own command.
# pre_window: nvm use

# Optional: tab to focus when done (name or 1-based number).
startup_window: editor

windows:
  # A window with a single command:
  - editor: nvim .

  # A window with several panes. Layouts (best effort): even-horizontal,
  # even-vertical, main-vertical, main-horizontal, tiled.
  - servers:
      layout: main-vertical
      panes:
        - npm run dev
        - npm run test -- --watch
        - # an empty pane (just a shell)

  # A window that runs a coding agent:
  - claude: claude .

  # A plain shell:
  - shell:
`;

export const emptyWorkspace = (
  name: string,
): string => `# ${name}.yml - a herdrinator workspace
#
# Start it with:  herdrinator start ${name}
#
# How to fill this in (tmuxinator-compatible format):
#
#   name: ${name}              # workspace label shown in herdr
#   root: ~/Projects/${name}   # working directory for all tabs and panes
#
#   # Optional: local commands run once before the workspace is built.
#   # on_project_start: git fetch --quiet
#
#   # Optional: commands typed into every pane before its own command.
#   # pre_window: nvm use
#
#   windows:                       # each window becomes a herdr tab
#     - editor: nvim .             # window name: command
#     - servers:                   # window with several panes
#         layout: main-vertical    # even-horizontal | even-vertical | main-vertical | main-horizontal | tiled
#         panes:
#           - npm run dev
#           - npm test -- --watch
#     - shell:                     # empty window = plain shell
#
# Uncomment and edit the lines above. \`herdrinator start ${name} --dry-run\`
# prints what would happen without touching herdr.
`;
