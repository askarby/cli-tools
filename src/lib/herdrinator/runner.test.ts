import { afterEach, describe, expect, it, vi } from "vitest";
import { Herdr } from "./herdr.ts";
import { buildWorkspace, planSplits } from "./runner.ts";
import type { WorkspaceSpec } from "./workspace.ts";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  spawnSync: vi.fn(),
}));
const childProcess = await import("node:child_process");

afterEach(() => vi.clearAllMocks());

describe("planSplits", () => {
  it("needs no splits for 0 or 1 panes", () => {
    expect(planSplits("tiled", 0)).toEqual([]);
    expect(planSplits("tiled", 1)).toEqual([]);
  });

  it.each([
    ["even-horizontal", ["right", "right"]],
    ["even-vertical", ["down", "down"]],
    ["main-vertical", ["right", "down"]],
    ["main-horizontal", ["down", "right"]],
    ["tiled", ["right", "down"]],
  ] as const)("%s with 3 panes", (layout, directions) => {
    expect(planSplits(layout, 3).map((split) => split.direction)).toEqual(
      directions,
    );
  });

  it("main layouts split the first pane first", () => {
    expect(planSplits("main-vertical", 3).map((s) => s.from)).toEqual([0, 1]);
  });
});

describe("buildWorkspace --dry-run", () => {
  it("runs nothing: no herdr calls and no local commands", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const spec: WorkspaceSpec = {
      id: "t",
      name: "T",
      file: "/x/t.yml",
      root: "/x",
      onStart: ["touch /should/not/run"],
      preWindow: [],
      windows: [
        {
          name: "a",
          root: "/x",
          pre: [],
          layout: "tiled",
          panes: [["ls"], []],
        },
        { name: "b", root: "/x", pre: [], layout: "tiled", panes: [[]] },
      ],
      startupWindow: "b",
      warnings: [],
    };
    const id = buildWorkspace(new Herdr(true), spec, true);
    expect(id).toMatch(/^<w\d+>$/);
    expect(childProcess.execFileSync).not.toHaveBeenCalled();
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
  });
});
