import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CliError } from "../shared/errors.ts";
import { loadConfig, writeConfig } from "./config.ts";
import { configPath } from "./paths.ts";
import { createHarness, type Harness } from "./test-harness.ts";

let h: Harness;
afterEach(() => h.cleanup());

describe("config", () => {
  it("loads repo, defaults target to $HOME and expands ~", () => {
    h = createHarness(false);
    h.homeFile(".config/dotty/config.toml", `repo = "~/dots"\n`);
    const config = loadConfig();
    expect(config.repo).toBe(join(homedir(), "dots"));
    expect(config.target).toBe(homedir());
    expect(config.ignore).toEqual([]);
  });

  it("falls back to ~/.config when XDG_CONFIG_HOME is empty", () => {
    h = createHarness(false);
    vi.stubEnv("XDG_CONFIG_HOME", "");
    expect(configPath()).toBe(join(h.home, ".config", "dotty", "config.toml"));
  });

  it("explains how to fix a missing file", () => {
    h = createHarness(false);
    expect(() => loadConfig()).toThrow(CliError);
    expect(() => loadConfig()).toThrow(/No config found/);
  });

  it.each([
    ["", /'repo' must be a non-empty string/],
    [`repo = "relative/path"`, /absolute/],
    [`repo = 5`, /non-empty string/],
    [`repo = "/x"\nignore = "no"`, /list of strings/],
    [`repo = `, /Could not parse/],
  ])("rejects bad config %#", (body, message) => {
    h = createHarness(false);
    h.homeFile(".config/dotty/config.toml", body);
    expect(() => loadConfig()).toThrow(message);
  });

  it("writeConfig creates the file once and never overwrites", () => {
    h = createHarness(false);
    writeConfig("~/dotfiles");
    expect(existsSync(configPath())).toBe(true);
    expect(h.read(configPath())).toContain(`repo = "~/dotfiles"`);
    expect(() => writeConfig("~/other")).toThrow(/already exists/);
    expect(h.read(configPath())).toContain("dotfiles");
  });
});
