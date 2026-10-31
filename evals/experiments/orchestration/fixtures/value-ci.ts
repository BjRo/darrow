import { appendFileSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  sevroCommand,
  sevroEnvironment,
} from "../../../sevro-extension/sevro-command";

type Task = {
  ci: string;
  nonce: string;
  title: string;
  body: string;
  base: string;
};
function git(root: string, ...args: string[]) {
  const run = Bun.spawnSync(["git", "-C", root, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (run.exitCode !== 0) throw new Error(run.stderr.toString());
  return run.stdout.toString().trim();
}
function fixtureRoot(input: unknown, task: Task) {
  if (typeof input !== "string") throw new Error("Missing fixture workspace");
  const root = realpathSync(input);
  const temporary = [realpathSync(tmpdir()), "/var/tmp", "/private/var/tmp"];
  if (!temporary.some((parent) => root.startsWith(parent + sep)))
    throw new Error("CI requires an isolated temporary fixture");
  const marker = JSON.parse(
    readFileSync(join(root, ".git/fixture-bin/task.json"), "utf8"),
  );
  if (marker.nonce !== task.nonce) throw new Error("Foreign fixture workspace");
  return root;
}
function cleanHead(root: string, head: string) {
  if (
    !/^[a-f0-9]{40}$/.test(head) ||
    git(root, "rev-parse", "HEAD") !== head ||
    git(root, "status", "--porcelain")
  )
    throw new Error("CI requires the exact clean final commit");
}
function published(root: string, head: string, task: Task) {
  cleanHead(root, head);
  const pr = JSON.parse(
    readFileSync(join(root, ".fixture-state/forge.json"), "utf8"),
  ).pr;
  if (
    !pr ||
    pr.state !== "OPEN" ||
    pr.isDraft ||
    pr.baseRefName !== task.base ||
    pr.headRefName === task.base
  )
    throw new Error("One ready open PR into the original base is required");
  const remote = git(
    root,
    "--git-dir=" + join(root, ".fixture-state/remote.git"),
    "rev-parse",
    `refs/heads/${pr.headRefName}`,
  );
  if (
    remote !== head ||
    git(root, "rev-list", "--count", `${task.base}..HEAD`) === "0"
  )
    throw new Error("The intended implementation must reach the PR branch");
}

type Receipts = Map<string, { root: string; exitCode: number }>;
function checkArguments(options: {
  directory: string;
  caseFile: string;
  sourceMap: string;
  sourceRoot: string;
  projectRoot: string;
}) {
  const { directory, caseFile, sourceMap, sourceRoot, projectRoot } = options;
  const route = sevroCommand();
  return [
    ...route.launch,
    "run",
    "--json",
    ...route.extraArgs,
    "--case-file",
    caseFile,
    "--adapter-module",
    join(import.meta.dir, "value-ci-host.ts"),
    "--case-source-root",
    sourceRoot,
    "--case-source-map-file",
    sourceMap,
    "--project-root",
    projectRoot,
    "--results-root",
    join(directory, "results"),
    "--condition",
    "passive",
    "--trials",
    "1",
    "--jobs",
    "1",
    "--threshold",
    "1",
    "--shell-isolation",
    "--runtime-config-file",
    join(import.meta.dir, "../../../sevro-extension/runtime-local-http.json"),
  ];
}
function clonePublished(root: string, directory: string) {
  const pr = JSON.parse(
    readFileSync(join(root, ".fixture-state/forge.json"), "utf8"),
  ).pr;
  const publishedSource = join(directory, "published");
  const clone = Bun.spawnSync(
    [
      "git",
      "clone",
      "--no-local",
      "--depth",
      "1",
      "--single-branch",
      "--branch",
      pr.headRefName,
      pathToFileURL(join(root, ".fixture-state/remote.git")).href,
      publishedSource,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (clone.exitCode !== 0) throw new Error(clone.stderr.toString());
  return publishedSource;
}
async function isolatedCheck(root: string, task: Task, evidence: string) {
  const directory = evidence + ".checks/" + crypto.randomUUID();
  await mkdir(directory, { recursive: true });
  const publishedSource = clonePublished(root, directory);
  const caseFile = join(directory, "case.json");
  const sourceMap = join(directory, "sources.json");
  await writeFile(
    sourceMap,
    JSON.stringify({ published: pathToFileURL(publishedSource).href }),
  );
  await writeFile(
    caseFile,
    JSON.stringify({
      id: "published-required-ci",
      prompt: JSON.stringify({ source: root }),
      fixture: { sourceRef: "published" },
      checks: [
        {
          id: "focused-upstream",
          grader: "sevro.shell",
          configuration: {
            run: 'PATH="$PWD/.git/fixture-bin:$PATH"\n' + task.ci,
            timeoutMs: 120000,
          },
        },
      ],
      requiredEvidence: [],
    }),
  );
  return runCheck(
    checkArguments({
      directory,
      caseFile,
      sourceMap,
      sourceRoot: directory,
      projectRoot: root,
    }),
    directory,
  );
}
async function runCheck(args: string[], directory: string) {
  const check = Bun.spawn(args, {
    env: sevroEnvironment(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(check.stdout).text(),
    new Response(check.stderr).text(),
    check.exited,
  ]);
  await writeFile(join(directory, "cli-result.json"), stdout);
  await writeFile(join(directory, "cli-stderr.log"), stderr);
  const result = JSON.parse(stdout);
  return {
    exitCode: exitCode === 0 && result.task?.verdict === "passed" ? 0 : 1,
    result: join(directory, "cli-result.json"),
    diagnostic: JSON.stringify(result).slice(0, 4096),
  };
}

async function executeCheck(
  input: { root?: string; head: string },
  task: Task,
  evidence: string,
  receipts: Receipts,
) {
  const root = fixtureRoot(input.root, task);
  published(root, input.head, task);
  const check = await isolatedCheck(root, task, evidence);
  published(root, input.head, task);
  const receipt = {
    root,
    head: input.head,
    command: task.ci,
    exitCode: check.exitCode,
    result: check.result,
  };
  receipts.set(input.head, receipt);
  appendFileSync(evidence, JSON.stringify(receipt) + "\n");
  if (check.exitCode !== 0)
    throw new Error(
      "The immutable required upstream check failed: " + check.diagnostic,
    );
  return Response.json({
    head: input.head,
    status: "success",
    command: task.ci,
  });
}

async function respond(
  request: Request,
  task: Task,
  evidence: string,
  receipts: Receipts,
) {
  try {
    if (request.method === "GET" && new URL(request.url).pathname === "/task") {
      return Response.json({
        title: task.title,
        body: task.body,
        base: task.base,
        ci: task.ci,
      });
    }
    if (request.method !== "POST")
      throw new Error("Unsupported CI fixture operation");
    const input = (await request.json()) as { root?: string; head: string };
    const operation = new URL(request.url).pathname;
    if (operation === "/run")
      return await executeCheck(input, task, evidence, receipts);
    if (operation !== "/verify")
      throw new Error("Unsupported CI fixture operation");
    const receipt = receipts.get(input.head);
    if (!receipt || receipt.exitCode !== 0)
      throw new Error(
        "No genuine successful CI invocation for the final commit",
      );
    published(receipt.root, input.head, task);
    return Response.json({
      publication: "verified",
      head: input.head,
      ci: "success",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    );
  }
}

/** A per-cell host fixture, closed in finally; candidate processes cannot write its receipts. */
export async function startValueCI(taskFile: string, evidence: string) {
  const task = JSON.parse(readFileSync(taskFile, "utf8")) as Task;
  const receipts: Receipts = new Map();
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 255,
    fetch: (request) => respond(request, task, evidence, receipts),
  });
}

if (import.meta.main) {
  const [task, evidence, ready] = process.argv.slice(2);
  if (!task || !evidence || !ready)
    throw new Error("Expected task, evidence and readiness paths");
  const server = await startValueCI(task, evidence);
  await Bun.write(ready, server.url.toString());
}
