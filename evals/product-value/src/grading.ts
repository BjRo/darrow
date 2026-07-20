import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Corpus, Observation, Phase } from "./types";
import { mean } from "./stats";

interface BlindMapping {
  schemaVersion: string;
  samples: Array<{ sampleId: string; runId: string; duplicate: boolean }>;
}

function opaque(seed: string, value: string): string {
  return new Bun.CryptoHasher("sha256")
    .update(`${seed}:${value}`)
    .digest("hex")
    .slice(0, 16);
}

async function loadObservations(resultsRoot: string): Promise<Observation[]> {
  const result: Observation[] = [];
  const glob = new Bun.Glob("runs/*/observation.json");
  for await (const rel of glob.scan(resultsRoot))
    result.push(JSON.parse(await readFile(join(resultsRoot, rel), "utf8")));
  return result;
}

export async function exportBlindBundles(
  corpus: Corpus,
  resultsRoot: string,
  seed: string,
  phase: Phase,
): Promise<{ bundles: number; duplicates: number }> {
  const observations = (await loadObservations(resultsRoot)).filter(
    (value) => value.assignment.phase === phase && value.patchPath,
  );
  const blindRoot = join(resultsRoot, "blind");
  const bundleRoot = join(blindRoot, "bundles");
  await rm(bundleRoot, { recursive: true, force: true });
  await rm(join(blindRoot, "graded-observations.jsonl"), { force: true });
  await mkdir(bundleRoot, { recursive: true });
  const samples: BlindMapping["samples"] = observations.map((observation) => ({
    sampleId: opaque(seed, observation.runId),
    runId: observation.runId,
    duplicate: false,
  }));
  const strata = new Map<string, typeof samples>();
  for (const sample of samples) {
    const observation = observations.find(
      (value) => value.runId === sample.runId,
    )!;
    const key = `${observation.assignment.repository}:${observation.assignment.stratum}`;
    strata.set(key, [...(strata.get(key) ?? []), sample]);
  }
  const duplicateSources = [...strata.values()].flatMap((group) =>
    [...group]
      .sort((a, b) =>
        opaque(seed, a.runId + ":dup").localeCompare(
          opaque(seed, b.runId + ":dup"),
        ),
      )
      .slice(0, Math.ceil(group.length * 0.1)),
  );
  const duplicateCount = duplicateSources.length;
  for (const source of duplicateSources)
    samples.push({
      sampleId: opaque(seed, source.runId + ":replicate"),
      runId: source.runId,
      duplicate: true,
    });
  samples.sort((a, b) => a.sampleId.localeCompare(b.sampleId));

  const gradeLines: string[] = [];
  for (const sample of samples) {
    const observation = observations.find(
      (value) => value.runId === sample.runId,
    )!;
    const task = corpus.tasks.find(
      (value) => value.id === observation.assignment.taskId,
    )!;
    const patch = await readFile(observation.patchPath!, "utf8");
    const rubric = task.rubric
      .map((item, index) => `${index + 1}. ${item} (0, 0.5, or 1)`)
      .join("\n");
    await writeFile(
      join(bundleRoot, `${sample.sampleId}.md`),
      `# Sample ${sample.sampleId}\n\n## Task\n\n${task.prompt}\n\n## Rubric\n\n${rubric}\n\n## Patch\n\n\`\`\`diff\n${patch}\n\`\`\`\n`,
    );
    gradeLines.push(
      JSON.stringify({
        sampleId: sample.sampleId,
        scores: task.rubric.map(() => null),
        note: "",
      }),
    );
  }
  const mapping: BlindMapping = { schemaVersion: "1.0.0", samples };
  await writeFile(
    join(blindRoot, "private-map.json"),
    JSON.stringify(mapping, null, 2) + "\n",
  );
  await writeFile(
    join(blindRoot, "grades.jsonl"),
    gradeLines.join("\n") + "\n",
  );
  return { bundles: samples.length, duplicates: duplicateCount };
}

export async function importBlindGrades(
  corpus: Corpus,
  resultsRoot: string,
  gradesPath: string,
  reverificationRoot?: string,
): Promise<{
  observations: number;
  agreementMeanAbsoluteDifference: number | null;
}> {
  const mapping: BlindMapping = JSON.parse(
    await readFile(join(resultsRoot, "blind", "private-map.json"), "utf8"),
  );
  const gradeRows = (await readFile(gradesPath, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { sampleId: string; scores: number[] });
  const known = new Set(mapping.samples.map((sample) => sample.sampleId));
  if (gradeRows.length !== mapping.samples.length)
    throw new Error("grade row count does not match blind bundle count");
  if (new Set(gradeRows.map((row) => row.sampleId)).size !== gradeRows.length)
    throw new Error("grade file contains duplicate sample IDs");
  const byRun = new Map<string, number[]>();
  for (const row of gradeRows) {
    if (!known.has(row.sampleId))
      throw new Error(`unknown sample: ${row.sampleId}`);
    if (
      !row.scores.length ||
      row.scores.some((score) => ![0, 0.5, 1].includes(score))
    )
      throw new Error(`invalid scores for sample ${row.sampleId}`);
    const runId = mapping.samples.find(
      (sample) => sample.sampleId === row.sampleId,
    )!.runId;
    const observation: Observation = JSON.parse(
      await readFile(
        join(resultsRoot, "runs", runId, "observation.json"),
        "utf8",
      ),
    );
    const task = corpus.tasks.find(
      (item) => item.id === observation.assignment.taskId,
    )!;
    if (row.scores.length !== task.rubric.length)
      throw new Error(`score count does not match rubric: ${row.sampleId}`);
    byRun.set(runId, [...(byRun.get(runId) ?? []), mean(row.scores)]);
  }
  const agreement: number[] = [];
  for (const scores of byRun.values())
    if (scores.length > 1) agreement.push(Math.abs(scores[0]! - scores[1]!));
  const graded: Array<{
    schemaVersion: "1.0.0";
    runId: string;
    deterministicQuality: number;
    blindedQuality: number;
    quality: number;
  }> = [];
  for (const [runId, scores] of byRun) {
    const path = join(resultsRoot, "runs", runId, "observation.json");
    const observationText = await readFile(path, "utf8");
    const observation: Observation = JSON.parse(observationText);
    const task = corpus.tasks.find(
      (item) => item.id === observation.assignment.taskId,
    )!;
    const blindedQuality = mean(scores);
    let deterministicQuality = observation.deterministicQuality;
    if (reverificationRoot) {
      const record = JSON.parse(
        await readFile(
          join(reverificationRoot, runId, "reverification.json"),
          "utf8",
        ),
      ) as {
        runId?: string;
        deterministicQuality?: number;
        identity?: { sourceObservationDigest?: string };
      };
      const observationDigest = `sha256:${new Bun.CryptoHasher("sha256")
        .update(observationText)
        .digest("hex")}`;
      if (
        record.runId !== runId ||
        record.identity?.sourceObservationDigest !== observationDigest ||
        ![0, 1].includes(record.deterministicQuality ?? Number.NaN)
      )
        throw new Error(`invalid reverification record: ${runId}`);
      deterministicQuality = record.deterministicQuality!;
    }
    const quality =
      task.grading === "deterministic"
        ? deterministicQuality
        : 0.7 * deterministicQuality + 0.3 * blindedQuality;
    graded.push({
      schemaVersion: "1.0.0",
      runId,
      deterministicQuality,
      blindedQuality,
      quality,
    });
  }
  graded.sort((a, b) => a.runId.localeCompare(b.runId));
  await writeFile(
    join(resultsRoot, "blind", "graded-observations.jsonl"),
    graded.map((value) => JSON.stringify(value)).join("\n") + "\n",
  );
  return {
    observations: byRun.size,
    agreementMeanAbsoluteDifference: agreement.length ? mean(agreement) : null,
  };
}
