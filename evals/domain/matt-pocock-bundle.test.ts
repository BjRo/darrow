import { expect, test } from "bun:test";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const plugin = resolve("plugins/capability/darrow-matt-pocock");
const selected = [
  "grilling",
  "wayfinder",
  "grill-with-docs",
  "domain-modeling",
  "diagnosing-bugs",
  "to-spec",
  "to-tickets",
  "wizard",
  "codebase-design",
  "improve-codebase-architecture",
  "writing-for-agents",
  "wait-what",
  "tdd",
  "implement",
  "research",
  "prototype",
  "setup-matt-pocock-skills",
].sort();

test("independent Matt package preserves the selected pinned directories and complete notices", async () => {
  const root = await mkdtemp(join(tmpdir(), "matt-package-"));
  try {
    await cp(plugin, join(root, "installed"), { recursive: true });
    const installed = join(root, "installed");
    expect((await readdir(join(installed, "skills"))).sort()).toEqual(selected);
    const manifests = await Promise.all(
      ["claude", "codex"].map(async (host) =>
        JSON.parse(
          await readFile(
            join(installed, `.${host}-plugin/plugin.json`),
            "utf8",
          ),
        ),
      ),
    );
    expect(manifests[0].name).toBe("darrow-matt-pocock");
    expect(manifests[1].name).toBe(manifests[0].name);
    expect(manifests[0].version).toBe(manifests[1].version);
    expect(manifests[1].skills).toBe("./skills/");
    expect(manifests[0].license).toBe("MIT");
    expect(manifests[1].license).toBe("MIT");
    const notice = await readFile(
      resolve("evals/domain/curated-inputs/matt.LICENSE"),
      "utf8",
    );
    expect(await readFile(join(installed, "LICENSE"), "utf8")).toContain(
      notice.trim(),
    );
    const provenance = await readFile(
      join(installed, "references/upstream/provenance.txt"),
      "utf8",
    );
    expect(provenance).toContain("abeeaf95660ba9e8b7c753eb38f441ca707a8823");
    expect(provenance).toContain("skills@1.9.0");
    const inventory = await readFile(
      resolve("evals/domain/matt-pocock-bundle-files.sha256"),
      "utf8",
    );
    expect(
      await readFile(
        join(installed, "references/upstream/files.sha256"),
        "utf8",
      ),
    ).toBe(inventory);
    const differences = JSON.parse(
      await readFile(
        join(installed, "references/upstream/local-differences.json"),
        "utf8",
      ),
    );
    for (const line of inventory.trim().split("\n")) {
      const [hash, path] = line.split(/ {2}/);
      const bytes = await readFile(join(installed, path!));
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (differences[path!]) {
        expect(differences[path!].reason.length).toBeGreaterThan(20);
        expect(actual, path).toBe(differences[path!].sha256);
        expect(actual, path).not.toBe(hash!);
      } else expect(actual, path).toBe(hash!);
    }
    for (const path of Object.keys(differences))
      expect(inventory).toContain(`  ${path}\n`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
