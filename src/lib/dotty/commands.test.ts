import { existsSync, lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakePrompts, createHarness, type Harness } from "./test-harness.ts";

let h: Harness;
beforeEach(() => {
  h = createHarness();
});
afterEach(() => h.cleanup());

const seed = (): void => {
  h.repoFile("zsh/.zshrc", "zsh");
  h.repoFile("git/.gitconfig", "git");
  h.repoFile("nvim/.config/nvim/init.lua", "nvim");
  h.repoFile("nvim/README.md", "ignored");
};

describe("init", () => {
  it("writes the config with --repo, creates the repo, never overwrites", async () => {
    const fresh = createHarness(false);
    try {
      const out = await fresh.dotty([
        "init",
        "--repo",
        join(fresh.home, "dots"),
      ]);
      expect(out).toContain("Wrote ~/.config/dotty/config.toml");
      expect(existsSync(join(fresh.home, "dots"))).toBe(true);
      const again = await fresh.dotty(["init", "--repo", "/elsewhere"]);
      expect(again).toContain("already exists");
      expect(process.exitCode).toBe(1);
    } finally {
      fresh.cleanup();
    }
  });

  it("prompts for the repo when interactive", async () => {
    const fresh = createHarness(false);
    try {
      const prompts = fakePrompts([join(fresh.home, "mine")]);
      await fresh.dotty(["init"], { prompts, isInteractive: () => true });
      expect(
        fresh.read(join(fresh.home, ".config/dotty/config.toml")),
      ).toContain("mine");
    } finally {
      fresh.cleanup();
    }
  });

  it("requires --repo when not interactive", async () => {
    const fresh = createHarness(false);
    try {
      expect(await fresh.dotty(["init"])).toContain("Pass --repo");
      expect(process.exitCode).toBe(1);
    } finally {
      fresh.cleanup();
    }
  });
});

describe("link", () => {
  it("links all packages, creating directories and skipping ignored files", async () => {
    seed();
    const out = await h.dotty(["link", "--all"]);
    expect(out).toContain("Linked 3 files from 3 packages");
    expect(h.isLink(join(h.home, ".zshrc"))).toBe(true);
    expect(h.linkTarget(join(h.home, ".zshrc"))).toBe(
      join(h.repo, "zsh/.zshrc"),
    );
    expect(lstatSync(join(h.home, ".config/nvim")).isDirectory()).toBe(true);
    expect(h.isLink(join(h.home, ".config/nvim/init.lua"))).toBe(true);
    expect(existsSync(join(h.home, "README.md"))).toBe(false);
  });

  it("links only the named packages and is idempotent", async () => {
    seed();
    await h.dotty(["link", "zsh"]);
    expect(h.isLink(join(h.home, ".gitconfig"))).toBe(false);
    const again = await h.dotty(["link", "zsh"]);
    expect(again).toContain("already linked");
    expect(again).toContain("Already up to date");
  });

  it("refuses all work on conflicts, naming them", async () => {
    seed();
    h.homeFile(".gitconfig", "mine");
    const out = await h.dotty(["link", "--all"]);
    expect(out).toContain("1 conflict: nothing was linked");
    expect(process.exitCode).toBe(1);
    expect(h.isLink(join(h.home, ".zshrc"))).toBe(false);
    expect(h.read(join(h.home, ".gitconfig"))).toBe("mine");
  });

  it("--dry-run changes nothing", async () => {
    seed();
    const out = await h.dotty(["link", "-a", "-n"]);
    expect(out).toContain("dry run");
    expect(readdirSync(h.home).sort()).toEqual([".config"]);
  });

  it("--target links elsewhere", async () => {
    seed();
    const other = join(h.sandbox.work, "other");
    await h.dotty(["link", "zsh", "--target", other]);
    expect(h.isLink(join(other, ".zshrc"))).toBe(true);
  });

  it("needs package names or --all, and rejects unknown/invalid ones", async () => {
    seed();
    expect(await h.dotty(["link"])).toContain("Name at least one package");
    expect(await h.dotty(["link", "nope"])).toContain("Unknown package: nope");
    expect(await h.dotty(["link", "../etc"])).toContain("Invalid package name");
  });

  it("explains a missing config", async () => {
    const fresh = createHarness(false);
    try {
      const out = await fresh.dotty(["link", "--all"]);
      expect(out).toContain("dotty init");
    } finally {
      fresh.cleanup();
    }
  });
});

describe("unlink", () => {
  it("removes only links into the repo and leaves repo files", async () => {
    seed();
    await h.dotty(["link", "--all"]);
    h.homeFile(".other", "keep");
    const out = await h.dotty(["unlink", "zsh"]);
    expect(out).toContain("Removed 1 link");
    expect(h.isLink(join(h.home, ".zshrc"))).toBe(false);
    expect(h.isLink(join(h.home, ".gitconfig"))).toBe(true);
    expect(h.read(join(h.repo, "zsh/.zshrc"))).toBe("zsh");
    expect(h.read(join(h.home, ".other"))).toBe("keep");
  });

  it("never touches real files that merely share a path", async () => {
    seed();
    h.homeFile(".zshrc", "mine");
    const out = await h.dotty(["unlink", "zsh"]);
    expect(out).toContain("not a dotty link");
    expect(h.read(join(h.home, ".zshrc"))).toBe("mine");
  });

  it("--dry-run keeps links", async () => {
    seed();
    await h.dotty(["link", "zsh"]);
    await h.dotty(["unlink", "zsh", "-n"]);
    expect(h.isLink(join(h.home, ".zshrc"))).toBe(true);
  });
});

describe("list and doctor", () => {
  it("shows linked / partial / unlinked / broken states", async () => {
    seed();
    h.repoFile("zsh/.zprofile", "p");
    await h.dotty(["link", "zsh", "git"]);
    await h.dotty(["unlink", "zsh"]);
    await h.dotty(["link", "zsh"]);
    // partial: remove one link by hand (test cleanup only)
    const { unlinkSync } = await import("node:fs");
    unlinkSync(join(h.home, ".zprofile"));
    const out = await h.dotty(["ls"]);
    expect(out).toMatch(/git\s+🟢 LINKED\s+1\/1/);
    expect(out).toMatch(/zsh\s+🟡 PARTIAL\s+1\/2/);
    expect(out).toMatch(/nvim\s+⚪ UNLINKED\s+0\/1/);
  });

  it("flags broken links and conflicts", async () => {
    seed();
    await h.dotty(["link", "git"]);
    const { rmSync } = await import("node:fs");
    rmSync(join(h.repo, "git/.gitconfig"));
    h.repoFile("git/.gitconfig", "recreated");
    // make the link dangle by pointing it at a missing file
    const { unlinkSync, symlinkSync } = await import("node:fs");
    unlinkSync(join(h.home, ".gitconfig"));
    symlinkSync(join(h.repo, "git/missing"), join(h.home, ".gitconfig"));
    const out = await h.dotty(["list"]);
    expect(out).toMatch(/git\s+🔴 BROKEN\s+0\/1\s+1 broken/);
  });

  it("doctor passes on a healthy setup and exits 0", async () => {
    seed();
    await h.dotty(["link", "--all"]);
    const out = await h.dotty(["doctor"]);
    expect(out).toContain("✅ zsh: 1 links ok");
    expect(process.exitCode).toBeUndefined();
  });

  it("doctor reports orphan links and exits 1", async () => {
    seed();
    await h.dotty(["link", "--all"]);
    const { rmSync } = await import("node:fs");
    rmSync(join(h.repo, "zsh/.zshrc"));
    const out = await h.dotty(["doctor"]);
    expect(out).toMatch(/❌ zsh: orphan link ~\/\.zshrc/);
    expect(process.exitCode).toBe(1);
  });

  it("doctor reports a missing repo and exits 1", async () => {
    const { rmSync } = await import("node:fs");
    rmSync(h.repo, { recursive: true });
    const out = await h.dotty(["doctor"]);
    expect(out).toContain("❌ repo missing");
    expect(process.exitCode).toBe(1);
  });
});

describe("adopt", () => {
  it("moves a file into the repo and links it back (flags, non-interactive)", async () => {
    h.homeFile(".gitconfig", "mine");
    const out = await h.dotty([
      "adopt",
      join(h.home, ".gitconfig"),
      "-p",
      "git",
      "-y",
    ]);
    expect(out).toContain("Adopted 1 file into git");
    expect(h.read(join(h.repo, "git/.gitconfig"))).toBe("mine");
    expect(h.linkTarget(join(h.home, ".gitconfig"))).toBe(
      join(h.repo, "git/.gitconfig"),
    );
  });

  it("walks through the guided prompts and adopts a directory", async () => {
    h.homeFile(".config/nvim/init.lua", "i");
    h.homeFile(".config/nvim/lua/a.lua", "a");
    const prompts = fakePrompts([join(h.home, ".config/nvim"), "nvim", true]);
    const out = await h.dotty(["adopt"], {
      prompts,
      isInteractive: () => true,
    });
    expect(prompts.asked).toHaveLength(3);
    expect(out).toContain("Step 1/3");
    expect(out).toContain("Adopted 2 files into nvim");
    expect(h.isLink(join(h.home, ".config/nvim/lua/a.lua"))).toBe(true);
    expect(h.read(join(h.repo, "nvim/.config/nvim/lua/a.lua"))).toBe("a");
  });

  it("does nothing when the confirmation is declined", async () => {
    h.homeFile(".gitconfig", "mine");
    const prompts = fakePrompts([false]);
    const out = await h.dotty(
      ["adopt", join(h.home, ".gitconfig"), "-p", "git"],
      {
        prompts,
        isInteractive: () => true,
      },
    );
    expect(out).toContain("Cancelled");
    expect(h.isLink(join(h.home, ".gitconfig"))).toBe(false);
  });

  it("refuses without --yes when not interactive, and in dry-run changes nothing", async () => {
    h.homeFile(".gitconfig", "mine");
    expect(
      await h.dotty(["adopt", join(h.home, ".gitconfig"), "-p", "git"]),
    ).toContain("--yes");
    expect(
      await h.dotty(["adopt", join(h.home, ".gitconfig"), "-p", "git", "-n"]),
    ).toContain("dry run");
    expect(h.isLink(join(h.home, ".gitconfig"))).toBe(false);
  });

  it.each([
    [
      "a symlink",
      (hh: Harness) => {
        hh.repoFile("x/f");
        return hh.dotty(["link", "x"]).then(() => join(hh.home, "f"));
      },
      /already a symlink/,
    ],
    [
      "a missing path",
      async (hh: Harness) => join(hh.home, "nope"),
      /Not found/,
    ],
    [
      "outside the target",
      async (hh: Harness) => hh.repoFile("y/f"),
      /not inside|already inside/,
    ],
    [
      "a protected folder",
      async (hh: Harness) => hh.homeFile(".ssh/config"),
      /Refusing to adopt anything under \.ssh/,
    ],
  ])("refuses %s", async (_name, setup, message) => {
    const path = await setup(h);
    const out = await h.dotty(["adopt", path, "-p", "pkg", "-y"]);
    expect(out).toMatch(message);
    expect(process.exitCode).toBe(1);
  });

  it("refuses when the package already has that file, and bad package names", async () => {
    h.repoFile("git/.gitconfig", "repo");
    h.homeFile(".gitconfig", "live");
    const out = await h.dotty([
      "adopt",
      join(h.home, ".gitconfig"),
      "-p",
      "git",
      "-y",
    ]);
    expect(out).toContain("already exist in package 'git'");
    expect(h.read(join(h.home, ".gitconfig"))).toBe("live");
    expect(
      await h.dotty(["adopt", join(h.home, ".gitconfig"), "-p", "../x", "-y"]),
    ).toContain("Invalid package name");
  });
});

describe("sync", () => {
  it("reports everything in sync", async () => {
    seed();
    await h.dotty(["link", "--all"]);
    expect(await h.dotty(["sync", "-y"])).toContain("Everything is in sync");
  });

  it("takes a changed live file into the repo and links it", async () => {
    seed();
    h.homeFile(".gitconfig", "edited");
    const prompts = fakePrompts(["take"]);
    const out = await h.dotty(["sync", "git"], {
      prompts,
      isInteractive: () => true,
    });
    expect(out).toContain("changed");
    expect(h.read(join(h.repo, "git/.gitconfig"))).toBe("edited");
    expect(h.isLink(join(h.home, ".gitconfig"))).toBe(true);
  });

  it("leaves both sides alone when skipped", async () => {
    seed();
    h.homeFile(".gitconfig", "edited");
    await h.dotty(["sync", "git"], {
      prompts: fakePrompts(["skip"]),
      isInteractive: () => true,
    });
    expect(h.read(join(h.repo, "git/.gitconfig"))).toBe("git");
    expect(h.isLink(join(h.home, ".gitconfig"))).toBe(false);
  });

  it("links identical files without asking", async () => {
    seed();
    h.homeFile(".gitconfig", "git");
    const out = await h.dotty(["sync", "git"], {
      prompts: fakePrompts([]),
      isInteractive: () => true,
    });
    expect(out).toContain("identical");
    expect(h.isLink(join(h.home, ".gitconfig"))).toBe(true);
  });

  it("finds new files in owned folders (not in top-level folders)", async () => {
    seed();
    await h.dotty(["link", "--all"]);
    h.homeFile(".config/nvim/extra.lua", "x");
    h.homeFile(".config/unrelated.toml", "x");
    h.homeFile(".stray", "x");
    const out = await h.dotty(["sync", "--yes"]);
    expect(out).toContain("~/.config/nvim/extra.lua");
    expect(out).not.toContain("unrelated");
    expect(out).not.toContain(".stray");
    expect(h.read(join(h.repo, "nvim/.config/nvim/extra.lua"))).toBe("x");
    expect(h.isLink(join(h.home, ".config/nvim/extra.lua"))).toBe(true);
    expect(h.isLink(join(h.home, ".config/unrelated.toml"))).toBe(false);
  });

  it("refuses without --yes when not interactive; dry-run is allowed and read-only", async () => {
    seed();
    h.homeFile(".gitconfig", "edited");
    expect(await h.dotty(["sync"])).toContain("--yes");
    expect(await h.dotty(["sync", "-n"])).toContain("dry run");
    expect(h.read(join(h.repo, "git/.gitconfig"))).toBe("git");
  });
});

describe("drop", () => {
  it("unlinks and moves the package to .dotty-trash without deleting", async () => {
    seed();
    await h.dotty(["link", "--all"]);
    const out = await h.dotty(["drop", "git", "-y"]);
    expect(out).toContain("Dropped git: unlinked 1 link");
    expect(h.isLink(join(h.home, ".gitconfig"))).toBe(false);
    expect(existsSync(join(h.repo, "git"))).toBe(false);
    const [trashed] = readdirSync(join(h.repo, ".dotty-trash"));
    expect(trashed).toMatch(/^git-/);
    expect(
      h.read(join(h.repo, ".dotty-trash", trashed ?? "", ".gitconfig")),
    ).toBe("git");
    expect(await h.dotty(["list"])).not.toContain("git ");
  });

  it("asks first, and refuses without --yes when not interactive", async () => {
    seed();
    expect(await h.dotty(["drop", "git"])).toContain("--yes");
    const out = await h.dotty(["drop", "git"], {
      prompts: fakePrompts([false]),
      isInteractive: () => true,
    });
    expect(out).toContain("Cancelled");
    expect(existsSync(join(h.repo, "git"))).toBe(true);
  });

  it("--dry-run changes nothing; unknown package is an error", async () => {
    seed();
    await h.dotty(["link", "git"]);
    await h.dotty(["drop", "git", "-n"]);
    expect(h.isLink(join(h.home, ".gitconfig"))).toBe(true);
    expect(existsSync(join(h.repo, "git"))).toBe(true);
    expect(await h.dotty(["drop", "nope", "-y"])).toContain("Unknown package");
  });
});
