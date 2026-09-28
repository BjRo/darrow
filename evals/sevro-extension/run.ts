import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  readCorpusManifest,
  resolveCorpusSource,
  type ResolvedCorpusSource,
} from "../corpus/orchestration/source";
import { selectedCaseFixture } from "./index";
import { sevroCommand } from "./sevro-command";
import {
  benchmarkConditionOptions,
  writeRunConfiguration,
} from "./benchmark-condition";
import { skillOverrideOptions } from "./skill-mount";
import { runBenchmarkPolicy } from "./benchmark-policy";

const repositoryRoot = resolve(import.meta.dir, "../..");
const extension = join(import.meta.dir, "index.ts");
const sourceFiles = [
  extension,
  join(repositoryRoot, "evals/fixture-ticket.ts"),
  join(import.meta.dir, "run.ts"),
  join(import.meta.dir, "selection.ts"),
  join(import.meta.dir, "schemas/cli-result-v1.schema.json"),
  join(import.meta.dir, "benchmark-condition.ts"),
  join(import.meta.dir, "skill-mount.ts"),
  join(import.meta.dir, "benchmark-policy.ts"),
  join(import.meta.dir, "benchmark-owner.ts"),
  join(import.meta.dir, "sevro-command.ts"),
  join(repositoryRoot, "evals/corpus/orchestration/source.ts"),
  join(repositoryRoot, "package.json"),
  join(repositoryRoot, "bun.lock"),
];
const reserved = new Set([
  "--case-id",
  "--case-file",
  "--project-root",
  "--results-root",
  "--extension-command-file",
  "--extension-source-file",
  "--case-source-root",
  "--case-source-map-file",
  "--corpus-manifest",
  "--runner-checkout-root",
  "--runner-build-digest",
  "--project-digest",
  "--extension-configuration-file",
  "--extension-redacted-configuration-file",
  "--json",
]);

function validateForwarded(forwarded: string[]): void {
  for (const token of forwarded) {
    if (token === "--" || reserved.has(token.split("=", 1)[0]!))
      throw new Error(`Sevro option is owned by Darrow: ${token}`);
  }
}

function sevroArgs(options: {
  commandFile: string;
  caseId: string;
  projectRoot: string;
  resultsRoot: string;
  forwarded: string[];
  configuration: boolean;
  conditionFile?: string;
}): string[] {
  const {
    commandFile,
    caseId,
    projectRoot,
    resultsRoot,
    forwarded,
    configuration,
    conditionFile,
  } = options;
  const route = sevroCommand();
  return [
    ...route.launch,
    "run",
    "--json",
    ...route.extraArgs,
    "--extension-command-file",
    commandFile,
    ...sourceFiles.flatMap((path) => ["--extension-source-file", path]),
    ...(conditionFile ? ["--extension-source-file", conditionFile] : []),
    "--case-id",
    caseId,
    "--project-root",
    projectRoot,
    "--results-root",
    resultsRoot,
    ...(configuration
      ? [
          "--extension-configuration-file",
          join(resultsRoot, "darrow-extension-configuration.json"),
          "--extension-redacted-configuration-file",
          join(resultsRoot, "darrow-extension-redacted-configuration.json"),
        ]
      : []),
    ...forwarded,
  ];
}

function runOptions(argv: string[]) {
  const separator = argv.indexOf("--");
  if (separator < 0) throw new Error("separate Sevro run options with --");
  const { values } = parseArgs({
    args: argv.slice(0, separator),
    options: {
      "case-id": { type: "string" },
      skill: { type: "string" },
      plugin: { type: "string" },
      case: { type: "string", multiple: true },
      "project-root": { type: "string" },
      "results-root": { type: "string" },
      "without-skill": { type: "boolean", default: false },
      "skill-dir": { type: "string" },
      "corpus-manifest": { type: "string" },
      "mount-plugin-skills": { type: "boolean", default: false },
      "require-evaluation-records": { type: "boolean", default: false },
      "assert-effective-owner-routes": { type: "string" },
      "benchmark-condition-file": { type: "string" },
      "benchmark-condition-label": { type: "string" },
      "benchmark-condition-sha256": { type: "string" },
    },
    strict: true,
  });
  if (
    values["corpus-manifest"] !== undefined &&
    !isAbsolute(values["corpus-manifest"])
  )
    throw new Error("corpus manifest path must be absolute");
  return { values, forwarded: argv.slice(separator + 1) };
}

/** Bind a selected Darrow case to the public Sevro CLI. */
export function invocation(argv: string[]) {
  const { values, forwarded } = runOptions(argv);
  const caseId = values["case-id"];
  const projectRoot = values["project-root"] ?? repositoryRoot;
  const resultsRoot = values["results-root"];
  if (!caseId || !resultsRoot)
    throw new Error("--case-id and --results-root are required");
  if (!isAbsolute(projectRoot) || !isAbsolute(resultsRoot))
    throw new Error("project and results roots must be absolute");
  const benchmark = benchmarkConditionOptions({
    conditionFile: values["benchmark-condition-file"],
    conditionLabel: values["benchmark-condition-label"],
    conditionSha256: values["benchmark-condition-sha256"],
  });
  const skillMount = skillOverrideOptions({
    skillDir: values["skill-dir"],
    mountPluginSkills: values["mount-plugin-skills"],
  });
  const policy = runBenchmarkPolicy(
    values["require-evaluation-records"],
    values["assert-effective-owner-routes"],
    caseId,
  );
  validateForwarded(forwarded);
  const commandFile = join(resultsRoot, "darrow-extension-command.json");
  return {
    commandFile,
    resultsRoot,
    projectRoot,
    caseId,
    withoutSkill: values["without-skill"],
    corpusManifest: values["corpus-manifest"],
    ...benchmark,
    ...skillMount,
    ...policy,
    command: sevroArgs({
      commandFile,
      caseId,
      projectRoot,
      resultsRoot,
      forwarded,
      configuration:
        values["without-skill"] ||
        !!benchmark.conditionFile ||
        Object.keys(policy).length > 0 ||
        Object.keys(skillMount).length > 0,
      conditionFile: benchmark.conditionFile,
    }),
  };
}

async function repositorySourceArgs(
  projectRoot: string,
  caseId: string,
  resultsRoot: string,
  corpusManifest?: string,
): Promise<string[]> {
  const fixture = await selectedCaseFixture({
    projectRoot: pathToFileURL(projectRoot).href,
    selectors: { caseIds: [caseId] },
  });
  const manifest =
    corpusManifest ??
    join(projectRoot, "evals/corpus/orchestration/manifest.yaml");
  if (corpusManifest) await readCorpusManifest(corpusManifest);
  if (fixture.kind !== "repository")
    return corpusManifest
      ? [
          "--extension-source-file",
          manifest,
          "--protected-root",
          dirname(manifest),
        ]
      : [];
  const bytes = await readFile(manifest);
  const source = await resolveCorpusSource(fixture.sourceRef, manifest);
  if (!bytes.equals(await readFile(manifest)))
    throw new Error("corpus manifest changed during source preflight");
  return sourceArguments({ source, manifest, bytes, caseId, resultsRoot });
}

async function sourceArguments(options: {
  source: ResolvedCorpusSource;
  manifest: string;
  bytes: Buffer;
  caseId: string;
  resultsRoot: string;
}) {
  const { source, manifest, bytes, caseId, resultsRoot } = options;
  const mapDigest = createHash("sha256")
    .update(`${caseId}\0${source.id}\0${source.path}\0${source.commit}`)
    .digest("hex");
  const mapFile = join(resultsRoot, `darrow-source-map-${mapDigest}.json`);
  await writeFile(
    mapFile,
    JSON.stringify({ [source.id]: pathToFileURL(source.path).href }),
  );
  const provenance = JSON.stringify({
    format: "darrow-corpus-source-v1",
    manifest: {
      path: manifest,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
    source,
  });
  const corpusDigest = createHash("sha256").update(provenance).digest("hex");
  const provenanceFile = join(
    resultsRoot,
    `darrow-corpus-source-${corpusDigest}.json`,
  );
  await retainCorpusProvenance(provenanceFile, provenance);
  return [
    "--extension-source-file",
    manifest,
    "--extension-source-file",
    provenanceFile,
    "--protected-root",
    dirname(manifest),
    "--case-source-root",
    dirname(source.path),
    "--case-source-map-file",
    mapFile,
  ];
}

async function retainCorpusProvenance(path: string, contents: string) {
  try {
    await writeFile(path, contents, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (
      !(await lstat(path)).isFile() ||
      (await readFile(path, "utf8")) !== contents
    )
      throw new Error("retained corpus provenance changed", { cause: error });
  }
}

if (import.meta.main) {
  try {
    const argv = process.argv.slice(2);
    const { values } = runOptions(argv);
    if (
      values.skill !== undefined ||
      values.plugin !== undefined ||
      values.case !== undefined
    ) {
      if (values["case-id"] !== undefined)
        throw new Error("--case-id cannot be combined with selection filters");
      const { runSelection } = await import("./selection");
      process.exitCode = await runSelection(argv, {
        projectRoot: values["project-root"] ?? repositoryRoot,
        resultsRoot: values["results-root"],
        skill: values.skill,
        plugin: values.plugin,
        filters: values.case ?? [],
      });
    } else {
      const selected = invocation(process.argv.slice(2));
      await mkdir(selected.resultsRoot, { recursive: true });
      await writeFile(
        selected.commandFile,
        JSON.stringify([process.execPath, extension]),
      );
      await writeRunConfiguration(selected);
      const sourceArgs = await repositorySourceArgs(
        selected.projectRoot,
        selected.caseId,
        selected.resultsRoot,
        selected.corpusManifest,
      );
      const child = Bun.spawn([...selected.command, ...sourceArgs], {
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      });
      const forwardInterrupt = () => child.kill("SIGINT");
      const forwardTerminate = () => child.kill("SIGTERM");
      process.on("SIGINT", forwardInterrupt);
      process.on("SIGTERM", forwardTerminate);
      process.exitCode = await child.exited;
      process.off("SIGINT", forwardInterrupt);
      process.off("SIGTERM", forwardTerminate);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 64;
  }
}
