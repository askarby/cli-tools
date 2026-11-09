import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  configDir,
  defaultWorkspacesDir,
  expandHome,
  rcPath,
} from "./paths.ts";

describe("configDir", () => {
  it("uses XDG_CONFIG_HOME when set", () => {
    vi.stubEnv("XDG_CONFIG_HOME", "/xdg");
    expect(configDir()).toBe(join("/xdg", "herdrinator"));
    expect(rcPath()).toBe(join("/xdg", "herdrinator", "herdrinatorrc.toml"));
    expect(defaultWorkspacesDir()).toBe(
      join("/xdg", "herdrinator", "workspaces"),
    );
  });

  it.each(["", undefined])(
    "falls back to ~/.config when XDG_CONFIG_HOME is %j",
    (value) => {
      vi.stubEnv("XDG_CONFIG_HOME", value);
      expect(configDir()).toBe(join(homedir(), ".config", "herdrinator"));
    },
  );
});

describe("expandHome", () => {
  it("expands ~ and ~/x", () => {
    expect(expandHome("~")).toBe(homedir());
    expect(expandHome("~/x")).toBe(join(homedir(), "x"));
  });

  it("leaves other paths alone", () => {
    expect(expandHome("/abs")).toBe("/abs");
    expect(expandHome("~user/x")).toBe("~user/x");
  });
});
