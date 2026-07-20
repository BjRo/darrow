import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importBlindGrades } from "../src/grading";
import type { Corpus, Observation } from "../src/types";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("imports grades as a reverified overlay without rewriting observations", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-grading-test-"));
  const reverification = await mkdtemp(
    join(tmpdir(), "darrow-reverification-test-"),
  );
  roots.push(root, reverification);
  const runId = "pilot-0001-fixture";
  const runRoot = join(root, "runs", runId);
  const blindRoot = join(root, "blind");
  await mkdir(runRoot, { recursive: true });
  await mkdir(blindRoot, { recursive: true });
  await mkdir(join(reverification, runId), { recursive: true });

  const corpus: Corpus = {
    schemaVersion: "1.0.0",
    repositories: [],
    tasks: [
      {
        id: "fixture-task",
        repository: "fixture",
        phase: "pilot",
        stratum: "simple",
        baseRevision: "a".repeat(40),
        oracleRevision: "b".repeat(40),
        prompt: "Implement the fixture.",
        verificationCommand: "true",
        grading: "mixed",
        rubric: ["correct"],
      },
    ],
  };
  const observation = {
    schemaVersion: "1.2.0",
    runId,
    assignment: {
      ordinal: 1,
      taskId: "fixture-task",
      repository: "fixture",
      phase: "pilot",
      stratum: "simple",
      harness: "codex",
      treatment: "plugins",
      repeat: 1,
      order: 1,
    },
    deterministicQuality: 0,
    blindedQuality: null,
    quality: 0,
  } as Observation;
  const observationPath = join(runRoot, "observation.json");
  const original = JSON.stringify(observation, null, 2) + "\n";
  await writeFile(observationPath, original);
  await writeFile(
    join(blindRoot, "private-map.json"),
    JSON.stringify({
      schemaVersion: "1.0.0",
      samples: [
        { sampleId: "sample-a", runId, duplicate: false },
        { sampleId: "sample-b", runId, duplicate: true },
      ],
    }),
  );
  const gradesPath = join(blindRoot, "grades.jsonl");
  await writeFile(
    gradesPath,
    [
      JSON.stringify({ sampleId: "sample-a", scores: [1] }),
      JSON.stringify({ sampleId: "sample-b", scores: [0.5] }),
    ].join("\n") + "\n",
  );
  await writeFile(
    join(reverification, runId, "reverification.json"),
    JSON.stringify({
      runId,
      deterministicQuality: 1,
      identity: {
        sourceObservationDigest: `sha256:${new Bun.CryptoHasher("sha256")
          .update(original)
          .digest("hex")}`,
      },
    }),
  );

  const result = await importBlindGrades(
    corpus,
    root,
    gradesPath,
    reverification,
  );

  expect(result).toEqual({
    observations: 1,
    agreementMeanAbsoluteDifference: 0.5,
  });
  expect(await readFile(observationPath, "utf8")).toBe(original);
  const overlay = JSON.parse(
    await readFile(join(blindRoot, "graded-observations.jsonl"), "utf8"),
  );
  expect(overlay).toEqual({
    schemaVersion: "1.0.0",
    runId,
    deterministicQuality: 1,
    blindedQuality: 0.75,
    quality: 0.9249999999999999,
  });
});
