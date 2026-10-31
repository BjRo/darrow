import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  realpath,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { historicalTasks, type prepareValue } from "./prepare-value";

type Baseline = Awaited<ReturnType<typeof prepareValue>>;
export interface Patch {
  path: string;
  beforeSha256: string;
  afterSha256: string;
  intent: string;
}
const review = "plugins/capability/darrow-review";
const strongRoute = '("codex", "gpt-6.1-sol"): ("high", "xhigh", "max"),';
const root = resolve(import.meta.dir, "../../..");
function sha(text: string) {
  return createHash("sha256").update(text).digest("hex");
}
export function replaceOnce(text: string, before: string, after: string) {
  if (text.split(before).length !== 2)
    throw new Error("Patch input must contain exactly one expected marker");
  return text.replace(before, after);
}
async function patchFile(
  directory: string,
  path: string,
  intent: string,
  mutate: (text: string) => string,
): Promise<Patch> {
  const target = join(directory, path);
  if (!(await realpath(target)).startsWith((await realpath(directory)) + sep))
    throw new Error("Patch target escapes its isolated copy");
  const before = await readFile(target, "utf8");
  const after = mutate(before);
  if (before === after) throw new Error("Patch did not change " + path);
  await writeFile(target, after);
  return { path, beforeSha256: sha(before), afterSha256: sha(after), intent };
}
export async function patchReviewer(project: string) {
  const admission = await patchFile(
    project,
    `${review}/backend/src/darrow_review/routing.py`,
    "Admit the explicitly requested experimental Sol 6.1/medium reviewer route only",
    (text) =>
      replaceOnce(
        text,
        strongRoute,
        '("codex", "gpt-6.1-sol"): ("medium", "high", "xhigh", "max"),',
      ),
  );
  const catalog = await patchFile(
    project,
    `${review}/config/reviewers.json`,
    "Select Sol 6.1/medium for the independent Codex review readers",
    (text) => {
      const config = JSON.parse(text);
      const selected = config.reviewers.find(
        (entry: { host: string }) => entry.host === "codex",
      );
      if (selected?.model !== "gpt-6.1-sol" || selected.effort !== "xhigh")
        throw new Error("Baseline reviewer is not Sol 6.1/xhigh");
      selected.effort = "medium";
      return JSON.stringify(config, null, 2) + "\n";
    },
  );
  return [admission, catalog];
}
function sevroPatches() {
  return [
    {
      file: "hosts/codex-app-server",
      replacements: [
        [
          "this.receivedBytes > 8 * 1024 * 1024",
          "this.receivedBytes > 128 * 1024 * 1024",
        ],
      ],
      intent:
        "Raise the finite cumulative app-server stream budget from 8 to 128 MiB",
    },
    {
      file: "native-transcripts",
      replacements: [
        ["MAX_BYTES = 5 * 1024 * 1024", "MAX_BYTES = 128 * 1024 * 1024"],
        [
          "MAX_ENCODED_FILES_BYTES = 7 * 1024 * 1024",
          "MAX_ENCODED_FILES_BYTES = 192 * 1024 * 1024",
        ],
      ],
      intent:
        "Retain up to 128 MiB raw transcripts with a 192 MiB encoded budget",
    },
    {
      file: "native-transcript-view",
      replacements: [
        [
          "MAX_NATIVE_BYTES = 5 * 1024 * 1024",
          "MAX_NATIVE_BYTES = 128 * 1024 * 1024",
        ],
      ],
      intent:
        "Keep the isolated grading transcript view compatible with the larger capture",
    },
  ];
}
export async function copyPatchedSevro(source: string, target: string) {
  const original = await realpath(source);
  const manifest = JSON.parse(
    await readFile(join(original, "package.json"), "utf8"),
  );
  if (manifest.name !== "@bjoernrochel/sevro" || manifest.version !== "1.1.1")
    throw new Error(
      "This temporary patch requires the frozen Sevro 1.1.1 package",
    );
  await mkdir(target);
  await cp(original, target, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (path) => path !== join(original, "node_modules"),
  });
  const patches = [];
  for (const patch of sevroPatches())
    for (const layer of ["source", "executable"]) {
      const path =
        layer === "source"
          ? `src/${patch.file}.ts`
          : `dist/src/${patch.file}.js`;
      patches.push(
        await patchFile(target, path, patch.intent, (text) =>
          patch.replacements.reduce(
            (value, [before, after]) => replaceOnce(value, before!, after!),
            text,
          ),
        ),
      );
    }
  await symlink(
    resolve(original, "../.."),
    join(target, "node_modules"),
    "dir",
  );
  return {
    version: manifest.version,
    originalPackage: original,
    binary: join(target, "dist/src/cli.js"),
    patches,
    limitsMiB: {
      appServerStream: 128,
      rawTranscripts: 128,
      encodedTranscripts: 192,
      transcriptView: 128,
    },
  };
}
async function callerEvidence(output: string) {
  const text = await readFile(new URL(import.meta.url), "utf8");
  const path = join(output, "prepare-review-effort.ts");
  await writeFile(path, text);
  return { path, sha256: sha(text) };
}

async function patchReviewStorage(project: string) {
  const patches = [];
  for (const track of ["implementation", "delivery"])
    for (const task of historicalTasks)
      patches.push(
        await patchFile(
          project,
          `evals/experiments/current-value/cases/${track}-${task}.yaml`,
          "Create fixture-owned review storage with the required private permissions",
          (text) =>
            replaceOnce(
              text,
              'mkdir -p "$HOME/.darrow/reviews"',
              'mkdir -p "$HOME/.darrow/reviews" && chmod 700 "$HOME/.darrow/reviews"',
            ),
        ),
      );
  return patches;
}

async function loadBaseline(baselineDirectory: string) {
  const bytes = await readFile(
    join(baselineDirectory, "benchmark.json"),
    "utf8",
  );
  const baseline = JSON.parse(bytes) as Baseline;
  if (
    baseline.format !== "darrow-current-value-v1" ||
    baseline.project !== join(baselineDirectory, "project")
  )
    throw new Error("Expected the original current-value snapshot layout");
  return { baseline, bytes };
}
/** Freeze a variant; never edit the original benchmark or installed packages. */
export async function prepareReviewEffort(
  baselineDirectory: string,
  output: string,
  packageDirectory = join(root, "node_modules/@bjoernrochel/sevro"),
) {
  if (!isAbsolute(baselineDirectory) || !isAbsolute(output))
    throw new Error("Baseline and output must be absolute");
  if (resolve(output).startsWith(resolve(baselineDirectory) + sep))
    throw new Error("Output must not be inside the frozen baseline");
  const { baseline, bytes } = await loadBaseline(baselineDirectory);
  await mkdir(output);
  const project = join(output, "project");
  await cp(baseline.project, project, {
    recursive: true,
    verbatimSymlinks: true,
  });
  const reviewerPatches = await patchReviewer(project);
  const fixturePatches = await patchReviewStorage(project);
  const sevro = await copyPatchedSevro(packageDirectory, join(output, "sevro"));
  const suites = Object.fromEntries(
    Object.entries(baseline.suites).map(([track, path]) => [
      track,
      join(project, relative(baseline.project, path)),
    ]),
  );
  const prepared = {
    ...baseline,
    project,
    suites,
    candidate: {
      ...baseline.candidate,
      reviewer: { model: "gpt-6.1-sol", effort: "medium" },
    },
    variant: {
      name: "review-medium",
      baseline: { directory: baselineDirectory, manifestSha256: sha(bytes) },
      reviewerPatches,
      fixturePatches,
      sevro,
      caller: await callerEvidence(output),
      boundary:
        "Experimental reviewer admission, observer budgets and private fixture review storage; participant prompts, acceptance checks, main-thread and implementation routing are inherited from the frozen baseline",
    },
  };
  await writeFile(
    join(output, "benchmark.json"),
    JSON.stringify(prepared, null, 2) + "\n",
  );
  return prepared;
}
if (import.meta.main) {
  const { values } = parseArgs({
    options: { baseline: { type: "string" }, output: { type: "string" } },
  });
  if (!values.baseline || !values.output)
    throw new Error("Supply --baseline and --output");
  const result = await prepareReviewEffort(values.baseline, values.output);
  console.log(
    JSON.stringify(
      { output: dirname(result.project), ...result.variant },
      null,
      2,
    ),
  );
}
