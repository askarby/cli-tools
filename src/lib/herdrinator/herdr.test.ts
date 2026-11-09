import { describe, expect, it, vi } from "vitest";
import { createFakeHerdr } from "./fake-herdr.ts";
import { CliError } from "./errors.ts";
import { Herdr } from "./herdr.ts";

describe("Herdr", () => {
  it("passes argv straight to the injected exec", () => {
    const fake = createFakeHerdr([{ label: "bob" }]);
    const workspaces = new Herdr(false, fake.exec).listWorkspaces();
    expect(workspaces.map((workspace) => workspace.label)).toEqual(["bob"]);
    expect(fake.calls).toEqual([["workspace", "list"]]);
  });

  it("dry-run fakes mutating calls and never executes them", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fake = createFakeHerdr();
    const herdr = new Herdr(true, fake.exec);
    const created = herdr.createWorkspace("x", "/tmp");
    herdr.run(created.root_pane.pane_id, "ls");
    herdr.closeWorkspace(created.workspace.workspace_id);
    expect(fake.calls).toEqual([]);
  });

  it("explains a missing binary", () => {
    const missing = Object.assign(new Error("spawn herdr ENOENT"), {
      code: "ENOENT",
    });
    const herdr = new Herdr(
      false,
      createFakeHerdr([], { failWith: missing }).exec,
    );
    expect(() => herdr.listWorkspaces()).toThrow(CliError);
    expect(() => herdr.listWorkspaces()).toThrow(/not found on your PATH/);
  });

  it("surfaces stderr from a failing herdr", () => {
    const failure = Object.assign(new Error("exit 1"), {
      stderr: "no server\n",
    });
    const herdr = new Herdr(
      false,
      createFakeHerdr([], { failWith: failure }).exec,
    );
    try {
      herdr.listWorkspaces();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).hint).toBe("no server");
    }
  });
});
