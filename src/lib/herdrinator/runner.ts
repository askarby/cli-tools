import { spawnSync } from "node:child_process";
import { CliError } from "./errors.ts";
import type { Direction, Herdr } from "./herdr.ts";
import { c, step } from "./ui.ts";
import type { Layout, WindowSpec, WorkspaceSpec } from "./workspace.ts";

interface Split {
  from: number;
  direction: Direction;
}

/** Best-effort translation of tmux layouts into a sequence of herdr splits (pane 0 already exists). */
export const planSplits = (layout: Layout, count: number): Split[] =>
  Array.from({ length: Math.max(0, count - 1) }, (_, offset): Split => {
    const index = offset + 1;
    const from = index - 1;
    switch (layout) {
      case "even-horizontal":
        return { from, direction: "right" };
      case "even-vertical":
        return { from, direction: "down" };
      case "main-vertical":
        return {
          from: index === 1 ? 0 : from,
          direction: index === 1 ? "right" : "down",
        };
      case "main-horizontal":
        return {
          from: index === 1 ? 0 : from,
          direction: index === 1 ? "down" : "right",
        };
      case "tiled":
        return { from, direction: index % 2 === 1 ? "right" : "down" };
    }
  });

const runLocal = (command: string, cwd: string, dryRun: boolean): void => {
  step(`${c.gray("local")} ${command}`);
  if (dryRun) return;
  const result = spawnSync("sh", ["-c", command], { cwd, stdio: "inherit" });
  if (result.status !== 0)
    throw new CliError(`Startup command failed: ${command}`);
};

const buildWindow = (
  herdr: Herdr,
  spec: WorkspaceSpec,
  window: WindowSpec,
  tabId: string,
  rootPane: string,
): void => {
  herdr.renameTab(tabId, window.name);
  const panes = [rootPane];
  for (const { from, direction } of planSplits(
    window.layout,
    window.panes.length,
  )) {
    const source = panes[from];
    if (source === undefined) continue;
    panes.push(herdr.splitPane(source, direction, window.root));
  }
  window.panes.forEach((commands, index) => {
    const pane = panes[index];
    if (pane === undefined) return;
    for (const command of [...spec.preWindow, ...window.pre, ...commands])
      herdr.run(pane, command);
  });
};

/** Builds the workspace described by `spec`; returns its herdr workspace id. */
export const buildWorkspace = (
  herdr: Herdr,
  spec: WorkspaceSpec,
  focus: boolean,
): string => {
  for (const command of spec.onStart)
    runLocal(command, spec.root, herdr.dryRun);

  const created = herdr.createWorkspace(spec.name, spec.root, [
    `HERDRINATOR_WORKSPACE=${spec.name}`,
  ]);
  const workspaceId = created.workspace.workspace_id;
  const tabIds = new Map<string, string>();

  spec.windows.forEach((window, index) => {
    const tab =
      index === 0
        ? { tab: created.tab, root_pane: created.root_pane }
        : herdr.createTab(workspaceId, window.name, window.root);
    tabIds.set(window.name, tab.tab.tab_id);
    buildWindow(herdr, spec, window, tab.tab.tab_id, tab.root_pane.pane_id);
  });

  const startup = spec.startupWindow;
  if (startup !== undefined) {
    const byIndex = spec.windows[Number(startup) - 1]?.name;
    const tabId =
      tabIds.get(startup) ??
      (byIndex === undefined ? undefined : tabIds.get(byIndex));
    if (tabId) herdr.focusTab(tabId);
  }
  if (focus) herdr.focusWorkspace(workspaceId);
  return workspaceId;
};
