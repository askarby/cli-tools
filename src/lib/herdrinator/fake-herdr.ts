import type { Exec, WorkspaceInfo } from "./herdr.ts";

export interface FakeHerdr {
  /** Pass as `Deps.exec`. */
  exec: Exec;
  /** Every argv received, in order. */
  calls: string[][];
  /** Argv of calls that would change herdr state (everything except list / --version). */
  writes: () => string[][];
}

/** A stand-in for the `herdr` binary: records calls and returns canned JSON. Never spawns anything. */
export const createFakeHerdr = (
  workspaces: Partial<WorkspaceInfo>[] = [],
  options: { failWith?: Error } = {},
): FakeHerdr => {
  const calls: string[][] = [];
  let id = 0;
  const exec: Exec = (args) => {
    calls.push(args);
    if (options.failWith) throw options.failWith;
    const key = args.slice(0, 2).join(" ");
    switch (key) {
      case "--version":
        return "herdr 1.2.3\n";
      case "workspace list":
        return JSON.stringify({
          result: {
            workspaces: workspaces.map((workspace, index) => ({
              workspace_id: `w-existing${index}`,
              label: "",
              tab_count: 1,
              pane_count: 1,
              focused: false,
              ...workspace,
            })),
          },
        });
      case "workspace create":
        return JSON.stringify({
          result: {
            workspace: {
              workspace_id: `w${++id}`,
              label: args[3],
              tab_count: 1,
              pane_count: 1,
              focused: false,
            },
            tab: { tab_id: `t${++id}`, label: "1" },
            root_pane: { pane_id: `p${++id}` },
          },
        });
      case "tab create":
        return JSON.stringify({
          result: {
            tab: { tab_id: `t${++id}`, label: args[5] },
            root_pane: { pane_id: `p${++id}` },
          },
        });
      case "pane split":
        return JSON.stringify({ result: { pane: { pane_id: `p${++id}` } } });
      default:
        return "";
    }
  };
  return {
    exec,
    calls,
    writes: () =>
      calls.filter(
        (call) =>
          call[0] !== "--version" &&
          call.slice(0, 2).join(" ") !== "workspace list",
      ),
  };
};
