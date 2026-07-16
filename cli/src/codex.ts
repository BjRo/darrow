import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { checkpointEvidence } from "./artifacts";
import { DarrowError } from "./errors";
import {
  canonicalJson,
  exists,
  hashDirectory,
  hashFile,
  readJson,
  replaceJson,
  sha256,
  writeJson,
} from "./io";
import { run } from "./process";
import { validateExternalSchema } from "./schema";
import { event } from "./state";
import type { ActivityInput, CommandResult } from "./types";

function failure(
  input: ActivityInput,
  invocationId: string,
  startedAt: string,
  category: string,
  message: string,
): CommandResult {
  return {
    invocationId,
    status: "failed",
    commandId: input.step.commandId,
    contractVersion: input.step.contractVersion,
    implementationVersion: input.step.contractVersion,
    artifacts: [],
    timing: { startedAt, finishedAt: new Date().toISOString() },
    error: { category, message },
  };
}

function metadata(path: string): Promise<Record<string, string>> {
  return readFile(path, "utf8").then((text) =>
    Object.fromEntries(
      text
        .trimEnd()
        .split("\n")
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    ),
  );
}

async function evidencePayload(root: string): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const phase of ["red", "green", "regression"] as const) {
    const item = await metadata(resolve(root, `${phase}.meta`));
    result[phase] = {
      command: item.command,
      exitStatus: Number(item.exit_status),
      startedAt: item.started_at,
      finishedAt: item.finished_at,
      stdout: item.stdout,
      stderr: item.stderr,
      workspaceDigest: item.workspace_digest,
    };
  }
  return result;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export interface EvidenceBroker {
  env: Record<string, string>;
  stop(): void;
  verify(): Promise<void>;
}

export async function startEvidenceBroker(
  commandDir: string,
  evidenceDir: string,
  workspace: string,
  attestationDir: string,
): Promise<EvidenceBroker> {
  const token = randomBytes(24).toString("hex");
  const key = randomBytes(32);
  const script = resolve(commandDir, "scripts", "evidence.sh");
  const phases = ["red", "green", "regression"] as const;
  const ipcDir = resolve(evidenceDir, ".broker");
  await mkdir(ipcDir, { recursive: true });
  await mkdir(attestationDir, { recursive: true });
  let nextPhase = 0;
  let busy = false;
  async function digest(phase: string): Promise<string> {
    const meta = await metadata(resolve(evidenceDir, `${phase}.meta`));
    delete meta.stdout;
    delete meta.stderr;
    return sha256(
      canonicalJson({
        meta,
        stdout: await hashFile(resolve(evidenceDir, `${phase}.stdout`)),
        stderr: await hashFile(resolve(evidenceDir, `${phase}.stderr`)),
      }),
    );
  }
  async function attest(phase: string): Promise<void> {
    const value = await digest(phase);
    const hmac = createHmac("sha256", key)
      .update(`${phase}\0${value}`)
      .digest("hex");
    await writeFile(
      resolve(attestationDir, `${phase}.attestation.json`),
      `${JSON.stringify({ schemaVersion: "0.1.0", phase, digest: value, hmac })}\n`,
      { flag: "wx", mode: 0o444 },
    );
  }
  async function verifyPhase(phase: string): Promise<void> {
    const record = await readJson<{
      phase: string;
      digest: string;
      hmac: string;
    }>(resolve(attestationDir, `${phase}.attestation.json`));
    const value = await digest(phase);
    const expected = createHmac("sha256", key)
      .update(`${phase}\0${value}`)
      .digest("hex");
    if (
      record.phase !== phase ||
      record.digest !== value ||
      record.hmac !== expected
    )
      throw new DarrowError(
        `evidence attestation failed: ${phase}`,
        "evidence",
      );
  }
  async function execute(
    args: string[],
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => !name.startsWith("DARROW_EVIDENCE_BROKER_"),
      ),
    ) as Record<string, string>;
    Object.assign(
      env,
      await guardEnvironment(resolve(attestationDir, "guards")),
    );
    let command: string[];
    if (process.platform === "darwin") {
      const gitCommon = run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        workspace,
      );
      if (gitCommon.exitCode !== 0)
        return { exitCode: 2, stdout: "", stderr: gitCommon.stderr };
      const profile = resolve(attestationDir, "evidence.sb");
      await writeFile(
        profile,
        `(version 1)
(allow file-write*
  (subpath ${JSON.stringify(resolve(workspace))})
  (subpath "/private/tmp")
  (regex #"^/private/var/folders/[^/]+/[^/]+/[T]/")
  (literal "/dev/null")
  (literal "/dev/random")
  (literal "/dev/zero")
  (regex #"^/dev/fd/[0-9]+$"))
(deny file-write* (subpath ${JSON.stringify(resolve(gitCommon.stdout.trim()))}))
(deny file-write*)
(deny network*)
(allow default)
`,
      );
      command = [
        "/usr/bin/sandbox-exec",
        "-f",
        profile,
        "bash",
        script,
        ...args,
      ];
    } else if (process.env.DARROW_CODEX_PERMISSION_PROFILE) {
      command = [
        "codex",
        "sandbox",
        "-P",
        process.env.DARROW_CODEX_PERMISSION_PROFILE,
        "-C",
        workspace,
        "--",
        "bash",
        script,
        ...args,
      ];
    } else
      return {
        exitCode: 2,
        stdout: "",
        stderr:
          "runtime-authenticated evidence requires macOS sandbox-exec or DARROW_CODEX_PERMISSION_PROFILE",
      };
    const child = Bun.spawn(command, {
      cwd: workspace,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { exitCode, stdout, stderr };
  }
  async function handle(body: {
    token?: string;
    operation?: string;
    phase?: string;
    expected?: string;
    command?: unknown;
  }): Promise<Record<string, unknown>> {
    if (body.token !== token) return { error: "unauthorized", exitCode: 2 };
    try {
      if (body.operation === "run") {
        if (
          !phases.includes(body.phase as (typeof phases)[number]) ||
          !Array.isArray(body.command) ||
          !body.command.every((item) => typeof item === "string")
        )
          return { error: "invalid evidence request", exitCode: 2 };
        const phase = body.phase!;
        if (phase !== phases[nextPhase])
          return {
            error: `evidence phase is out of order or already completed: ${phase}`,
            exitCode: 2,
          };
        const args = ["run", evidenceDir, phase];
        if (body.expected) args.push("--expected", body.expected);
        args.push("--", ...(body.command as string[]));
        const result = await execute(args);
        if (result.exitCode === 0) {
          await attest(phase);
          nextPhase += 1;
        }
        return result;
      }
      if (body.operation === "validate") {
        if (nextPhase !== phases.length)
          return { error: "evidence sequence is incomplete", exitCode: 2 };
        for (const phase of phases) await verifyPhase(phase);
        return execute(["validate", evidenceDir]);
      }
      return { error: "invalid evidence operation", exitCode: 2 };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        exitCode: 2,
      };
    }
  }
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      for (const name of (await readdir(ipcDir))
        .filter((item) => item.endsWith(".request.json"))
        .sort()) {
        const requestPath = resolve(ipcDir, name);
        const responsePath = resolve(
          ipcDir,
          name.replace(".request.json", ".response.json"),
        );
        if (await exists(responsePath)) continue;
        const body = await readJson<{
          token?: string;
          operation?: string;
          phase?: string;
          expected?: string;
          command?: unknown;
        }>(requestPath);
        await replaceJson(responsePath, await handle(body));
      }
    } finally {
      busy = false;
    }
  }, 20);
  return {
    env: {
      DARROW_EVIDENCE_BROKER_DIR: ipcDir,
      DARROW_EVIDENCE_BROKER_TOKEN: token,
    },
    stop: () => clearInterval(timer),
    verify: async () => {
      if (nextPhase !== phases.length)
        throw new DarrowError("evidence sequence is incomplete", "evidence");
      for (const phase of phases) await verifyPhase(phase);
    },
  };
}

export async function guardEnvironment(
  root: string,
): Promise<Record<string, string>> {
  const hooks = resolve(root, ".guard-hooks");
  const bin = resolve(root, ".guard-bin");
  await mkdir(hooks, { recursive: true });
  await mkdir(bin, { recursive: true });
  for (const name of ["pre-commit", "pre-push"]) {
    await writeFile(
      resolve(hooks, name),
      "#!/bin/sh\necho 'Darrow M1 forbids commits and pushes' >&2\nexit 1\n",
      { mode: 0o755 },
    );
  }
  const git = Bun.which("git");
  if (!git) throw new DarrowError("git is unavailable", "git");
  await writeFile(
    resolve(bin, "git"),
    `#!/bin/sh
command_name=''
skip_next=0
for arg in "$@"; do
  if [ "$skip_next" = 1 ]; then skip_next=0; continue; fi
  case "$arg" in -C|-c|--git-dir|--work-tree|--namespace) skip_next=1; continue ;; --git-dir=*|--work-tree=*|--namespace=*|--*) continue ;; -*) continue ;; *) command_name=$arg; break ;; esac
done
case "$command_name" in commit|push|fetch|pull|send-email|tag|notes|remote) echo "Darrow M1 forbids git $command_name" >&2; exit 1 ;; esac
exec ${shellQuote(git)} "$@"
`,
    { mode: 0o755 },
  );
  const guards: Record<string, string[]> = {
    bun: ["add", "install", "remove", "update", "upgrade", "x"],
    npm: ["add", "install", "i", "uninstall", "remove", "update", "upgrade"],
    pnpm: ["add", "install", "i", "remove", "update", "upgrade", "dlx"],
    yarn: ["add", "install", "remove", "up", "upgrade", "dlx"],
    pip: ["install", "uninstall"],
    pip3: ["install", "uninstall"],
    uv: ["add", "remove", "sync", "lock", "pip", "tool"],
    cargo: ["add", "install", "update"],
    go: ["get", "install"],
    bundle: ["install", "update", "add"],
    composer: ["install", "update", "require", "remove"],
  };
  for (const [name, forbidden] of Object.entries(guards)) {
    const executable = Bun.which(name);
    if (!executable) continue;
    await writeFile(
      resolve(bin, name),
      `#!/bin/sh
case "\${1:-}" in ${forbidden.join("|")}) echo "Darrow M1 forbids dependency changes through ${name}" >&2; exit 1 ;; esac
exec ${shellQuote(executable)} "$@"
`,
      { mode: 0o755 },
    );
  }
  await writeFile(
    resolve(bin, "npx"),
    "#!/bin/sh\necho 'Darrow M1 forbids npx because it may install packages implicitly' >&2\nexit 1\n",
    { mode: 0o755 },
  );
  await writeFile(
    resolve(bin, "gh"),
    "#!/bin/sh\necho 'Darrow M1 forbids GitHub mutations' >&2\nexit 1\n",
    { mode: 0o755 },
  );
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.hooksPath",
    GIT_CONFIG_VALUE_0: hooks,
    PATH: `${bin}:${process.env.PATH ?? ""}`,
  };
}

function changedPaths(workspace: string): string[] {
  const tracked = run(["git", "diff", "--name-only", "HEAD"], workspace);
  const untracked = run(
    ["git", "ls-files", "--others", "--exclude-standard"],
    workspace,
  );
  if (tracked.exitCode !== 0 || untracked.exitCode !== 0)
    throw new DarrowError("cannot inspect changed paths", "git");
  return [
    ...new Set(
      `${tracked.stdout}\n${untracked.stdout}`
        .split("\n")
        .map((path) => path.trim())
        .filter((path) => path && !path.startsWith(".darrow-attempts/")),
    ),
  ].sort();
}

async function executeCodexCommandInternal(
  input: ActivityInput,
  invocationId: string,
  startedAt: string,
): Promise<CommandResult> {
  const [pluginName, skillName, ...extra] = input.step.commandId.split(":");
  if (!pluginName || !skillName || extra.length > 0)
    return failure(
      input,
      invocationId,
      startedAt,
      "contract",
      `invalid command ID: ${input.step.commandId}`,
    );
  const commandDir = resolve(
    input.snapshotDir,
    "commands",
    pluginName,
    skillName,
  );
  const outputSchema = resolve(commandDir, "output.schema.json");
  const inputSchema = resolve(commandDir, "input.schema.json");
  const evidenceDir = resolve(
    input.workspace,
    ".darrow-attempts",
    input.runId,
    input.attemptId,
  );
  const outputFile = resolve(evidenceDir, "result.json");
  const transcript = resolve(input.runDir, "content", `${invocationId}.jsonl`);
  const stderrPath = resolve(input.runDir, "content", `${invocationId}.stderr`);
  await mkdir(evidenceDir, { recursive: true });
  await mkdir(resolve(input.runDir, "content"), { recursive: true });
  if ((await hashDirectory(commandDir)) !== input.step.digest)
    return failure(
      input,
      invocationId,
      startedAt,
      "snapshot_corrupt",
      "snapshotted command digest does not match the immutable plan",
    );
  await validateExternalSchema(inputSchema, input.step.input, "command input");
  const lockPath = resolve(input.runDir, "lock.json");
  if (await exists(lockPath)) {
    const lock = await readJson<{
      adapter: {
        nativePermissions: {
          configurationSource: string;
          configurationDigest: string;
        };
      };
    }>(lockPath);
    const permissionConfig = lock.adapter.nativePermissions;
    if (
      permissionConfig.configurationSource !== "environment-defaults" &&
      (await hashFile(permissionConfig.configurationSource)) !==
        permissionConfig.configurationDigest
    ) {
      return failure(
        input,
        invocationId,
        startedAt,
        "preflight_stale",
        "native Codex permission configuration changed after the run was locked",
      );
    }
  }
  for (const capability of input.planCapabilities ?? []) {
    const providerParts = capability.providerId.split(":");
    const capabilityDir = resolve(
      input.snapshotDir,
      "capabilities",
      providerParts[0]!,
      providerParts[1]!,
    );
    if ((await hashDirectory(capabilityDir)) !== capability.digest)
      return failure(
        input,
        invocationId,
        startedAt,
        "snapshot_corrupt",
        `snapshotted capability changed: ${capability.contract}`,
      );
    if ((await hashDirectory(capability.source)) !== capability.digest)
      return failure(
        input,
        invocationId,
        startedAt,
        "preflight_stale",
        `enabled capability changed after preflight: ${capability.contract}`,
      );
  }
  const installed = run(["codex", "--version"], input.workspace);
  if (installed.exitCode !== 0)
    return failure(
      input,
      invocationId,
      startedAt,
      "model_unavailable",
      installed.stderr.trim() || "Codex CLI is unavailable",
    );
  const headBefore = run(
    ["git", "rev-parse", "HEAD"],
    input.workspace,
  ).stdout.trim();
  const prompt = [
    `Invoke the snapshotted Darrow command ${input.step.commandId}@${input.step.contractVersion}.`,
    `Read and follow ${resolve(commandDir, "SKILL.md")} exactly.`,
    `Requested change: ${String(input.step.input.change)}`,
    `Evidence directory: ${evidenceDir}`,
    "Darrow already preflighted a compatible branch-creation capability. Create the local branch by expressing that intent; do not name a capability provider.",
    "Return only the structured result required by the supplied output schema.",
  ].join("\n");
  const args = [
    "codex",
    "exec",
    "--json",
    "--model",
    input.profile.model,
    "--config",
    `model_provider=\"${input.profile.provider}\"`,
    "--config",
    `model_reasoning_effort=\"${input.profile.reasoningEffort}\"`,
    "--cd",
    input.workspace,
    "--output-schema",
    outputSchema,
    "--output-last-message",
    outputFile,
    "-",
  ];
  await event(input.runDir, input.runId, "command.invocation.started", {
    invocationId,
    stepId: input.step.id,
    attemptId: input.attemptId,
    commandId: input.step.commandId,
  });
  const broker = await startEvidenceBroker(
    commandDir,
    evidenceDir,
    input.workspace,
    resolve(input.runDir, "content", "attestations", invocationId),
  );
  let stdout: string;
  let stderr: string;
  let exitCode: number;
  try {
    const child = Bun.spawn(args, {
      cwd: input.workspace,
      env: {
        ...process.env,
        ...(await guardEnvironment(
          resolve(input.runDir, "runtime", "guards", invocationId),
        )),
        ...broker.env,
      },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    child.stdin.write(prompt);
    child.stdin.end();
    [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
  } catch (error) {
    broker.stop();
    return failure(
      input,
      invocationId,
      startedAt,
      "harness",
      error instanceof Error ? error.message : String(error),
    );
  }
  broker.stop();
  await writeFile(transcript, stdout);
  await writeFile(stderrPath, stderr);
  let nativeSessionId: string | undefined;
  let usage: Record<string, number> | undefined;
  for (const line of stdout.split("\n").filter(Boolean)) {
    try {
      const item = JSON.parse(line) as {
        type?: string;
        thread_id?: string;
        usage?: Record<string, number>;
      };
      if (item.type === "thread.started") nativeSessionId = item.thread_id;
      if (item.type === "turn.completed" && item.usage) usage = item.usage;
    } catch {
      /* preserve malformed native output in the transcript */
    }
  }
  if (exitCode !== 0) {
    const category = /model|not found|unavailable|unsupported/i.test(stderr)
      ? "model_unavailable"
      : "harness";
    const result = failure(
      input,
      invocationId,
      startedAt,
      category,
      stderr.trim() || `Codex exited ${exitCode}`,
    );
    result.transcript = transcript;
    result.nativeSessionId = nativeSessionId;
    await event(input.runDir, input.runId, "command.invocation.failed", {
      invocationId,
      category,
      exitCode,
      transcript,
    });
    return result;
  }
  if ((await hashDirectory(commandDir)) !== input.step.digest)
    return failure(
      input,
      invocationId,
      startedAt,
      "snapshot_corrupt",
      "snapshotted command changed during invocation",
    );
  const validate = run(
    [
      "bash",
      resolve(commandDir, "scripts", "evidence.sh"),
      "validate",
      evidenceDir,
    ],
    input.workspace,
  );
  if (validate.exitCode !== 0) {
    const result = failure(
      input,
      invocationId,
      startedAt,
      "evidence",
      validate.stderr.trim() || "TDD evidence validation failed",
    );
    result.transcript = transcript;
    result.nativeSessionId = nativeSessionId;
    return result;
  }
  await broker.verify();
  if (!(await exists(outputFile)))
    return failure(
      input,
      invocationId,
      startedAt,
      "contract",
      "Codex did not produce the command result",
    );
  const payload = await readJson<Record<string, unknown>>(outputFile);
  payload.evidence = await evidencePayload(evidenceDir);
  payload.changedPaths = changedPaths(input.workspace);
  const branch = run(
    ["git", "symbolic-ref", "--short", "HEAD"],
    input.workspace,
  );
  if (branch.exitCode !== 0)
    return failure(
      input,
      invocationId,
      startedAt,
      "side_effect",
      "command did not create a local branch",
    );
  payload.branch = branch.stdout.trim();
  const headAfter = run(
    ["git", "rev-parse", "HEAD"],
    input.workspace,
  ).stdout.trim();
  if (headAfter !== headBefore)
    return failure(
      input,
      invocationId,
      startedAt,
      "forbidden_effect",
      "command created a commit; M1 permits working-tree changes only",
    );
  await validateExternalSchema(outputSchema, payload, "command result");
  const artifact = await checkpointEvidence(
    input.repoRoot,
    input.runDir,
    input.step.id,
    input.attemptId,
    evidenceDir,
    outputSchema,
  );
  const evidence = payload.evidence as Record<string, Record<string, unknown>>;
  for (const phase of ["red", "green", "regression"]) {
    evidence[phase]!.stdout = `${artifact.location}/${phase}.stdout`;
    evidence[phase]!.stderr = `${artifact.location}/${phase}.stderr`;
  }
  await validateExternalSchema(
    outputSchema,
    payload,
    "checkpointed command result",
  );
  await writeJson(
    resolve(
      input.runDir,
      "results",
      `${input.step.id}-${input.attemptId}.json`,
    ),
    payload,
  );
  const result: CommandResult = {
    invocationId,
    status: "succeeded",
    commandId: input.step.commandId,
    contractVersion: input.step.contractVersion,
    implementationVersion: input.step.contractVersion,
    payload,
    artifacts: [artifact],
    transcript,
    nativeSessionId,
    usage,
    timing: { startedAt, finishedAt: new Date().toISOString() },
  };
  await event(input.runDir, input.runId, "command.invocation.completed", {
    invocationId,
    stepId: input.step.id,
    attemptId: input.attemptId,
    artifacts: [artifact],
    transcript,
    nativeSessionId: nativeSessionId ?? null,
    usage: usage ?? null,
  });
  return result;
}

export async function executeCodexCommand(
  input: ActivityInput,
): Promise<CommandResult> {
  const invocationId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  try {
    return await executeCodexCommandInternal(input, invocationId, startedAt);
  } catch (error) {
    const category = error instanceof DarrowError ? error.category : "harness";
    const message = error instanceof Error ? error.message : String(error);
    const result = failure(input, invocationId, startedAt, category, message);
    const transcript = resolve(
      input.runDir,
      "content",
      `${invocationId}.jsonl`,
    );
    if (await exists(transcript)) result.transcript = transcript;
    await mkdir(resolve(input.runDir, "results"), { recursive: true });
    await writeJson(
      resolve(
        input.runDir,
        "results",
        `${input.step.id}-${input.attemptId}.failure.json`,
      ),
      result,
    ).catch(() => {});
    await event(input.runDir, input.runId, "command.invocation.failed", {
      invocationId,
      category,
      message,
      transcript: result.transcript ?? null,
    }).catch(() => {});
    return result;
  }
}
