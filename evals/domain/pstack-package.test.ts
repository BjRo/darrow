import { expect, test } from "bun:test";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

// Independent original-source bytes: Darrow de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89;
// unslop: cursor/plugins aaeb0ea3a0584995aa8f55ce44c6c5259414b896.
const sourceDigests: Record<string, string> = {
  "skills/principle-attack-the-premise/SKILL.md":
    "151f2655eece30e744747b1e423fef306254fa940115acdfaa2fa343a557e73b",
  "skills/principle-boundary-discipline/SKILL.md":
    "691d44948b2b3acab1588d852e0e6a7b0752c87cf7d265afe3ce71b73e4751bd",
  "skills/principle-build-the-lever/SKILL.md":
    "3edb81045d44aa02398503798771e9e0efa318e15db1da597ec21c70f1042e98",
  "skills/principle-encode-lessons-in-structure/SKILL.md":
    "8214420a74475f68b9e7bbfe72ad42d0c38caea754edfc4474490c7e193d52e2",
  "skills/principle-exhaust-the-design-space/SKILL.md":
    "1c0b3960899632cf0d55df6efa5bc3c1b2bbdcf9c2c2d1813503ba3d534494cb",
  "skills/principle-experience-first/SKILL.md":
    "8a6c0e213c65a09e7aefc91b8f534c79d9a69ca1df84147b194c87d8416acf64",
  "skills/principle-explain-the-number/SKILL.md":
    "0942fd8825dd0a6947604db867857eb23470840ddbd5a0d2aa492e62994d204a",
  "skills/principle-fix-root-causes/SKILL.md":
    "826676cdcbef347dc1845dfc36982e00bbfefd62340464b5fcb10e23ffaa44a6",
  "skills/principle-foundational-thinking/SKILL.md":
    "d90e9aac663a315d5e70da31548ccc418b4b745455af316fbfd9deb0a40221bd",
  "skills/principle-guard-the-context-window/SKILL.md":
    "20a08f40b3f98aa425069fb0cc6f8b8c11c054c11fa8506f4561a6df0706ea74",
  "skills/principle-laziness-protocol/SKILL.md":
    "98fd3acddcb7d78fb19b20530e4367dcfce595bd63cef16a6df6047270a51053",
  "skills/principle-make-operations-idempotent/SKILL.md":
    "0f2dd8fa753b7f9d355b1d34a3880368bff063c8130f1a0b1fa363145e754f09",
  "skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md":
    "758231591710cabaf61953d9e404d3dc2e3f5597a98e6edc1c250a9198ee334b",
  "skills/principle-minimize-reader-load/SKILL.md":
    "ab304f7d1b2722ee619bcb54b89f50e30d0a785efed3f9015775145c29c280b0",
  "skills/principle-model-the-domain/SKILL.md":
    "8aef281692749faee56813ab0c29523c055472b0e53ae1a254bad0fcdb414d67",
  "skills/principle-never-block-on-the-human/SKILL.md":
    "e4ef175ad7b783975123f9e9cd3ead02ea5e250f1ba19f99dfef658431652db0",
  "skills/principle-outcome-oriented-execution/SKILL.md":
    "e676f78951d2bb7136cc3cdfb2cb4d35c4c6318b15282e327a8f23a79f474850",
  "skills/principle-prove-it-works/SKILL.md":
    "4da7f696d953363db06c1a880a83847e683c30a3d44e82f93fd37dcdbe81836c",
  "skills/principle-redesign-from-first-principles/SKILL.md":
    "33395f89a5ff3562e3cbc0bff100f6ea7592b62d141a74690dcb343acd1d37d0",
  "skills/principle-separate-before-serializing-shared-state/SKILL.md":
    "e51bc06e3e836564910f0e40fb4837853bd7b0b045909e89c515ad768f8c064b",
  "skills/principle-sequence-verifiable-units/SKILL.md":
    "e56681bf9f721cb025763998a011d566b025735b35fa07d77385193b7e703ad5",
  "skills/principle-subtract-before-you-add/SKILL.md":
    "57816950cf4f835f84713e27cbe1bf7522fbb35dd50e53e10070129a4a982351",
  "skills/principle-test-behavior-not-implementation/SKILL.md":
    "00cdc968e4f029cead526e90e4cd8a5e298eb25a95ac23c8a35f9287a774b906",
  "skills/principle-type-system-discipline/SKILL.md":
    "29e327d4c05cced12a6acd8e21099553ef6c966c2dbf2c01093852a4c6b547f7",
  // Darrow added the citation rule after the copy (#359); original bytes
  // dbf5776a99ffe22a355d9000cdcf8e159a7134624e3535060ba10a8f13e1964a.
  "skills/principles-first/SKILL.md":
    "9f94e98aedb24c369bfb245a3b4a6ee8f578958ba70b2ffce2aa9b2c00aba199",
  "skills/setup-principles/SKILL.md":
    "4cde61bc851f2173e6135a378b8552d5f29524359cfe388917a27d480064bde4",
  "skills/principles-first/assets/default-principles.md":
    "649fb1d7ccbf0727903a538431524bb38118f7c48c301c13b563694b43c7703c",
  "skills/unslop/SKILL.md":
    "2b823fd069e031c1420180be8e0d4f5e2fd25bf2c428049e5c835c59a489b5e0",
};

const workflowSources: Record<string, string> = {
  "skills/benchmark-checklist/SKILL.md":
    "5efd79495e3eebf3b53814861330fe812458212958f8f009492e866c329161f6",
  "skills/blast-radius/SKILL.md":
    "4248d03e22365207d2e5f90c9542720f80a88a6b42fd542ef88dde3cf9f9223f",
  "skills/correct/SKILL.md":
    "e347045d00c967a0b831ef883cc6ac79d21329aa10b5968637df95de7febf0ba",
  "skills/create-verification-skill/SKILL.md":
    "d353973547bf8ad8977eca645f4cd4feaed0d32f4b43d1448f906b0a76c4d694",
  "skills/create-verification-skill/references/feature-map-example/README.md":
    "cb7bd782cf89968a4ba3d58a5151db837430db92d19a6f52a906973b77b516ba",
  "skills/create-verification-skill/references/feature-map-example/create-note.md":
    "644a44c74f35d38c2feb7cd05a0121fdebbb623e8dc376c185b565a581d1ccf7",
  "skills/create-verification-skill/references/feature-map-example/search.md":
    "6e87b9e7f2791a7776ba1bb83f371cd285c306c67f19d245cc4dd6ca3015c823",
  "skills/maintain-verification-skill/SKILL.md":
    "515c0eaa054b3f6be1b1fb06f2c2f173c80fddb58bbcac57576f89c479bc68e8",
  "skills/reflect/SKILL.md":
    "6f6952f91514dc86257830da93a446c732a1af906f6acd5e5783dc587a29031e",
  "skills/why/SKILL.md":
    "6b65b3180f1f1bd3b696d7933daf900747410c82931d220a3f57a98addb1c0fd",
  LICENSE: "bc957ca6bee02792566a1a028d105e02e247c6e77cf057061674273da77b200e",
};
const workflowNames = Object.keys(workflowSources)
  .filter((path) => /^skills\/[^/]+\/SKILL\.md$/.test(path))
  .map((path) => path.split("/")[1]!);

test("standalone pstack package preserves selected source and both host entrypoints", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "darrow-pstack-package-"));
  const artifact = join(scratch, "darrow-pstack");
  try {
    await cp(
      resolve(import.meta.dir, "../../plugins/capability/darrow-pstack"),
      artifact,
      { recursive: true },
    );
    const skills = await readdir(join(artifact, "skills"));
    expect(skills.sort()).toEqual(
      [
        ...Object.keys(sourceDigests)
          .filter((path) => path.endsWith("/SKILL.md"))
          .map((path) => path.split("/")[1]!),
        ...workflowNames,
      ].sort(),
    );
    for (const [path, digest] of Object.entries(sourceDigests)) {
      expect(
        createHash("sha256")
          .update(await readFile(join(artifact, path)))
          .digest("hex"),
        path,
      ).toBe(digest);
    }
    for (const name of workflowNames) {
      const body = await readFile(
        join(artifact, "skills", name, "SKILL.md"),
        "utf8",
      );
      expect(parse(body.split("---")[1]!).name).toBe(name);
      expect(parse(body.split("---")[1]!)["disable-model-invocation"]).toBe(
        true,
      );
      const config = parse(
        await readFile(
          join(artifact, "skills", name, "agents/openai.yaml"),
          "utf8",
        ),
      );
      expect(config.policy.allow_implicit_invocation).toBe(false);
    }
    const inventory = await readFile(
      join(artifact, "references/workflows/upstream-files.sha256"),
      "utf8",
    );
    expect(
      Object.fromEntries(
        inventory
          .trim()
          .split("\n")
          .map((line) => {
            const [digest, path] = line.split("  ");
            return [path, digest];
          }),
      ),
    ).toEqual(workflowSources);
    for (const [path, digest] of Object.entries(workflowSources)) {
      if (!path.includes("/references/")) continue;
      expect(
        createHash("sha256")
          .update(await readFile(join(artifact, path)))
          .digest("hex"),
        path,
      ).toBe(digest);
    }
    expect(
      createHash("sha256")
        .update(
          await readFile(
            join(artifact, "references/workflows/UPSTREAM-LICENSE"),
          ),
        )
        .digest("hex"),
    ).toBe(workflowSources.LICENSE!);
    expect(
      await readFile(
        join(artifact, "references/workflows/upstream-provenance.txt"),
        "utf8",
      ),
    ).toContain("7a583913eb1b8d1a0ee76753d1a2cf072e7b54f9");
    const claude = JSON.parse(
      await readFile(join(artifact, ".claude-plugin/plugin.json"), "utf8"),
    );
    const codex = JSON.parse(
      await readFile(join(artifact, ".codex-plugin/plugin.json"), "utf8"),
    );
    expect(claude.name).toBe("darrow-pstack");
    expect(codex.name).toBe(claude.name);
    expect(codex.version).toBe(claude.version);
    expect(codex.skills).toBe("./skills/");
    expect(claude.license).toBe("MIT");
    const license = await readFile(join(artifact, "LICENSE"), "utf8");
    const upstreamNotice = await readFile(
      join(artifact, "UPSTREAM-LICENSE"),
      "utf8",
    );
    expect(createHash("sha256").update(upstreamNotice).digest("hex")).toBe(
      "bc957ca6bee02792566a1a028d105e02e247c6e77cf057061674273da77b200e",
    );
    expect(license.startsWith(upstreamNotice)).toBe(true);
    expect(license).toContain("Copyright (c) 2026 Lauren Tan");
    expect(license).toContain("Copyright (c) 2026 Björn Rochel");
    expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
