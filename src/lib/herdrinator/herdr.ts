import { execFileSync } from "node:child_process";
import { CliError } from "./errors.ts";
import { c, say } from "./ui.ts";

export interface WorkspaceInfo {
  workspace_id: string;
  label: string;
  tab_count: number;
  pane_count: number;
  focused: boolean;
}
export interface TabInfo {
  tab_id: string;
  label: string;
}
interface PaneInfo {
  pane_id: string;
}
export interface CreatedWorkspace {
  workspace: WorkspaceInfo;
  tab: TabInfo;
  root_pane: PaneInfo;
}
export interface CreatedTab {
  tab: TabInfo;
  root_pane: PaneInfo;
}

export type Direction = "right" | "down";

interface Envelope<T> {
  result: T;
}

/** Typed wrapper over the `herdr` CLI. With `dryRun`, mutating calls are printed and faked. */
export class Herdr {
  readonly dryRun: boolean;
  #fakeIds = 0;

  constructor(dryRun = false) {
    this.dryRun = dryRun;
  }

  #exec(args: string[]): string {
    try {
      return execFileSync("herdr", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { stderr?: string };
      if (err.code === "ENOENT") {
        throw new CliError(
          "herdr was not found on your PATH",
          "Install it from https://herdr.dev",
        );
      }
      throw new CliError(
        `herdr ${args.slice(0, 2).join(" ")} failed`,
        err.stderr?.trim() || "Is the herdr server running? Try `herdr`.",
      );
    }
  }

  #read<T>(args: string[]): T {
    return (JSON.parse(this.#exec(args)) as Envelope<T>).result;
  }

  /** Runs a mutating call, or prints it and returns `fake()` in dry-run mode. */
  #write<T>(args: string[], fake: () => T): T {
    if (this.dryRun) {
      say(`  ${c.gray("$ herdr " + args.join(" "))}`);
      return fake();
    }
    const output = this.#exec(args).trim();
    return (output === "" ? {} : JSON.parse(output)) as T;
  }

  #fake(prefix: string): string {
    return `<${prefix}${++this.#fakeIds}>`;
  }

  listWorkspaces(): WorkspaceInfo[] {
    return this.#read<{ workspaces: WorkspaceInfo[] }>(["workspace", "list"])
      .workspaces;
  }

  createWorkspace(
    label: string,
    cwd: string,
    env: string[] = [],
  ): CreatedWorkspace {
    const args = [
      "workspace",
      "create",
      "--label",
      label,
      "--cwd",
      cwd,
      "--no-focus",
    ];
    for (const pair of env) args.push("--env", pair);
    return this.#write<Envelope<CreatedWorkspace>>(args, () => ({
      result: {
        workspace: {
          workspace_id: this.#fake("w"),
          label,
          tab_count: 1,
          pane_count: 1,
          focused: false,
        },
        tab: { tab_id: this.#fake("t"), label: "1" },
        root_pane: { pane_id: this.#fake("p") },
      },
    })).result;
  }

  createTab(workspaceId: string, label: string, cwd: string): CreatedTab {
    const args = [
      "tab",
      "create",
      "--workspace",
      workspaceId,
      "--label",
      label,
      "--cwd",
      cwd,
      "--no-focus",
    ];
    return this.#write<Envelope<CreatedTab>>(args, () => ({
      result: {
        tab: { tab_id: this.#fake("t"), label },
        root_pane: { pane_id: this.#fake("p") },
      },
    })).result;
  }

  splitPane(paneId: string, direction: Direction, cwd: string): string {
    const args = [
      "pane",
      "split",
      paneId,
      "--direction",
      direction,
      "--cwd",
      cwd,
      "--no-focus",
    ];
    return this.#write<Envelope<{ pane: PaneInfo }>>(args, () => ({
      result: { pane: { pane_id: this.#fake("p") } },
    })).result.pane.pane_id;
  }

  run(paneId: string, command: string): void {
    this.#write(["pane", "run", paneId, command], () => ({}));
  }

  renameTab(tabId: string, label: string): void {
    this.#write(["tab", "rename", tabId, label], () => ({}));
  }

  focusTab(tabId: string): void {
    this.#write(["tab", "focus", tabId], () => ({}));
  }

  focusWorkspace(workspaceId: string): void {
    this.#write(["workspace", "focus", workspaceId], () => ({}));
  }

  closeWorkspace(workspaceId: string): void {
    this.#write(["workspace", "close", workspaceId], () => ({}));
  }

  /** Workspace that `action` calls should act on: runner env, herdr's own env, else the focused one. */
  currentWorkspaceId(): string {
    const fromEnv =
      process.env["HERDRINATOR_WORKSPACE_ID"] ||
      process.env["HERDR_WORKSPACE_ID"];
    if (fromEnv) return fromEnv;
    const focused = this.listWorkspaces().find(
      (workspace) => workspace.focused,
    );
    if (!focused)
      throw new CliError(
        "No active herdr workspace found",
        "Create one with `herdrinator action workspace <name>`.",
      );
    return focused.workspace_id;
  }
}
