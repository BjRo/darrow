import { afterAll, expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  prepareReviewEffort,
  replaceOnce,
} from "../experiments/orchestration/prepare-review-effort";
import { historicalTasks } from "../experiments/orchestration/prepare-value";

const temporary: string[] = [];
afterAll(async () => {
  for (const path of temporary)
    await rm(path, { recursive: true, force: true });
});
async function put(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value);
}
async function baseline() {
  const root = await mkdtemp(join(tmpdir(), "review-effort-variant-"));
  temporary.push(root);
  const source = join(root, "baseline");
  const project = join(source, "project");
  const review = join(project, "plugins/capability/darrow-review");
  await put(
    join(review, "backend/src/darrow_review/routing.py"),
    '("codex", "gpt-6.1-sol"): ("high", "xhigh", "max"),\n',
  );
  await put(
    join(review, "config/reviewers.json"),
    JSON.stringify({
      reviewers: [
        { host: "codex", model: "gpt-6.1-sol", effort: "xhigh" },
        { host: "claude", model: "claude-opus-5-5", effort: "xhigh" },
      ],
    }),
  );
  await put(
    join(project, "case.yaml"),
    "prompt: original task\nchecks: unchanged\n",
  );
  for (const track of ["implementation", "delivery"])
    for (const task of historicalTasks)
      await put(
        join(
          project,
          `evals/experiments/current-value/cases/${track}-${task}.yaml`,
        ),
        'prompt: original task\nfixture:\n  setup: |-\n    mkdir -p "$HOME/.darrow/reviews"\nchecks: unchanged\n',
      );
  await put(
    join(source, "benchmark.json"),
    JSON.stringify({
      format: "darrow-current-value-v1",
      project,
      candidate: {
        model: "gpt-6.1-sol",
        effort: "medium",
        implementationRouting: "current-policy",
      },
      suites: {
        implementation: join(project, "implementation.yaml"),
        delivery: join(project, "delivery.yaml"),
      },
    }),
  );
  const sevro = join(root, "node_modules/@bjoernrochel/sevro");
  await put(
    join(sevro, "package.json"),
    JSON.stringify({ name: "@bjoernrochel/sevro", version: "1.1.1" }),
  );
  const files = {
    "hosts/codex-app-server": "this.receivedBytes > 8 * 1024 * 1024\n",
    "native-transcripts":
      "MAX_BYTES = 5 * 1024 * 1024\nMAX_ENCODED_FILES_BYTES = 7 * 1024 * 1024\n",
    "native-transcript-view": "MAX_NATIVE_BYTES = 5 * 1024 * 1024\n",
  };
  for (const [file, text] of Object.entries(files))
    for (const layer of ["src", "dist/src"])
      await put(
        join(sevro, `${layer}/${file}.${layer === "src" ? "ts" : "js"}`),
        text,
      );
  return { root, source, project, review, sevro };
}
test("medium-review and capture patches are confined to fresh copies with exact provenance", async () => {
  const original = await baseline();
  const config = await readFile(
    join(original.review, "config/reviewers.json"),
    "utf8",
  );
  const result = await prepareReviewEffort(
    original.source,
    join(original.root, "variant"),
    original.sevro,
  );
  expect(result.candidate).toMatchObject({
    model: "gpt-6.1-sol",
    effort: "medium",
    reviewer: { model: "gpt-6.1-sol", effort: "medium" },
  });
  expect(await readFile(join(result.project, "case.yaml"), "utf8")).toBe(
    await readFile(join(original.project, "case.yaml"), "utf8"),
  );
  expect(result.suites.delivery).toBe(join(result.project, "delivery.yaml"));
  expect(result.variant.reviewerPatches).toHaveLength(2);
  expect(result.variant.fixturePatches).toHaveLength(8);
  expect(result.variant.sevro.patches).toHaveLength(6);
  const patchedConfig = JSON.parse(
    await readFile(
      join(
        result.project,
        "plugins/capability/darrow-review/config/reviewers.json",
      ),
      "utf8",
    ),
  );
  expect(
    patchedConfig.reviewers.map((r: { effort: string }) => r.effort),
  ).toEqual(["medium", "xhigh"]);
  expect(
    await readFile(join(original.review, "config/reviewers.json"), "utf8"),
  ).toBe(config);
  expect(
    await readFile(
      join(original.sevro, "src/hosts/codex-app-server.ts"),
      "utf8",
    ),
  ).toContain("> 8 * 1024 * 1024");
  expect(
    await readFile(
      join(original.root, "variant/sevro/dist/src/hosts/codex-app-server.js"),
      "utf8",
    ),
  ).toContain("> 128 * 1024 * 1024");
  const fixture = result.variant.fixturePatches[0]!;
  const before = await readFile(join(original.project, fixture.path), "utf8");
  const after = await readFile(join(result.project, fixture.path), "utf8");
  expect(after).toBe(
    before.replace(
      'mkdir -p "$HOME/.darrow/reviews"',
      'mkdir -p "$HOME/.darrow/reviews" && chmod 700 "$HOME/.darrow/reviews"',
    ),
  );
  const home = join(original.root, "fixture-home");
  const storage = join(home, ".darrow/reviews");
  await mkdir(storage, { recursive: true, mode: 0o755 });
  for (const shell of ["bash", "/bin/bash"]) {
    const run = Bun.spawnSync([shell, "-c", after.split("\n")[3]!.trim()], {
      env: { ...process.env, HOME: home },
    });
    expect(run.exitCode).toBe(0);
    expect((await stat(storage)).mode & 0o777).toBe(0o700);
  }
  await expect(
    prepareReviewEffort(
      original.source,
      join(original.root, "variant"),
      original.sevro,
    ),
  ).rejects.toThrow();
  await expect(
    prepareReviewEffort(
      original.source,
      join(original.source, "nested"),
      original.sevro,
    ),
  ).rejects.toThrow("inside the frozen baseline");
});
test("literal patches refuse absent or repeated markers", () => {
  expect(() => replaceOnce("changed upstream", "expected", "new")).toThrow(
    "exactly one",
  );
  expect(() => replaceOnce("expected expected", "expected", "new")).toThrow(
    "exactly one",
  );
});
