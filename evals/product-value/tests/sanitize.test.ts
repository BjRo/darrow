import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sanitizeWorkspace } from "../src/sanitize";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("product-value sanitizer (PV-5)", () => {
  test("removes agent support and secrets but retains product files", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-sanitize-test-"));
    roots.push(root);
    await mkdir(join(root, ".agents", "skills"), { recursive: true });
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, ".github"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "instructions");
    await writeFile(join(root, ".agents", "skills", "x.md"), "skill");
    await writeFile(join(root, ".github", "copilot-instructions.md"), "rules");
    await writeFile(join(root, ".env"), "SECRET=value");
    await writeFile(join(root, ".env.example"), "SECRET=");
    await writeFile(join(root, "src", "index.ts"), "export {};");

    const result = await sanitizeWorkspace(root, "a".repeat(40));

    expect(result.removedPaths).toEqual([
      ".agents",
      ".env",
      ".github/copilot-instructions.md",
      "AGENTS.md",
    ]);
    expect(await Bun.file(join(root, "src", "index.ts")).exists()).toBe(true);
    expect(await Bun.file(join(root, ".env.example")).exists()).toBe(true);
    expect(result.treeDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test("refuses a symlink escaping the clean copy", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-sanitize-test-"));
    roots.push(root);
    await writeFile(join(root, "safe.txt"), "safe");
    await symlink("/tmp", join(root, "escape"));
    await expect(sanitizeWorkspace(root, "b".repeat(40))).rejects.toThrow(
      "escaping symlink",
    );
  });
});
