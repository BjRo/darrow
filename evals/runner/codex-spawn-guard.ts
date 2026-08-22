import {
  lstat,
  readFile,
  readdir,
  readlink,
  writeFile,
} from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

const OWNER_MARKER = "- phase: adaptive-goal-runner";
const ATTESTATION_PREFIX = "- darrow_eval_spawn_attestation: ";

export interface CodexSpawnAttestation {
  model: string;
  effort: string;
  forkTurns: "none";
  requestSha256: string;
  objectiveSha256: string;
  contractSha256: string;
  baselineSha256: string;
  fixtureStateSha256: string;
  objectiveMode: "inline" | "file-backed";
  attachmentDir?: string;
}

export interface CodexSpawnGuardPolicy {
  secret: string;
  baselineSha256: string;
  fixtureStateSha256: string;
  requestSha256: string;
  objectiveRoot: string;
  goalLoopPath: string;
  statePath: string;
}

interface CodexSpawnGuardState {
  parentTurnId: string;
  attestation: CodexSpawnAttestation;
}

const CONTRACT_LABELS = [
  "Outcome",
  "Acceptance criteria",
  "Scope",
  "Non-goals",
  "Preserved work",
  "Permissions",
  "Workflow sequence",
  "Feedback checks",
  "Final-tree checks",
  "Independent review",
  "Stopping budget",
  "Human feedback",
  "Completion report",
] as const;

const FIXTURE_STATE_ENTRY =
  /^(?:fixture-|independent-review-|review-|human-feedback-|verification-|gh-|pricing-|version-|ticketctl\.log$)/;

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fingerprintEntry(
  root: string,
  path: string,
  records: string[],
  excludeGitDirectory = false,
): Promise<void> {
  const stat = await lstat(path);
  const name = relative(root, path);
  if (stat.isDirectory()) {
    if (excludeGitDirectory && name === ".git") return;
    records.push(`dir\0${name}\0`);
    const entries = await readdir(path);
    entries.sort();
    for (const entry of entries)
      await fingerprintEntry(
        root,
        join(path, entry),
        records,
        excludeGitDirectory,
      );
    return;
  }
  if (stat.isSymbolicLink()) {
    records.push(`link\0${name}\0${await readlink(path)}\0`);
    return;
  }
  if (!stat.isFile()) throw new Error(`unsupported worktree entry: ${name}`);
  const contents = await readFile(path);
  records.push(
    `file\0${name}\0${stat.mode & 0o111 ? "x" : "-"}\0${sha256(contents)}\0`,
  );
}

/** Content identity for the repository worktree, excluding Git-private state. */
export async function repositoryFingerprint(repoDir: string): Promise<string> {
  const root = resolve(repoDir);
  const records: string[] = [];
  const entries = await readdir(root);
  entries.sort();
  for (const entry of entries)
    await fingerprintEntry(root, join(root, entry), records, true);
  return sha256(records.join(""));
}

/** Identity for evaluator-owned fixture inputs and traces stored in .git. */
export async function fixtureStateFingerprint(
  repoDir: string,
): Promise<string> {
  const gitDir = join(resolve(repoDir), ".git");
  const records: string[] = [];
  const entries = (await readdir(gitDir))
    .filter(
      (entry) => entry === "fixture-bin" || FIXTURE_STATE_ENTRY.test(entry),
    )
    .sort();
  for (const entry of entries)
    await fingerprintEntry(gitDir, join(gitDir, entry), records);
  return sha256(records.join(""));
}

function recordValue(contract: string, key: string): string | undefined {
  const matches = contract
    .split(/\r?\n/)
    .filter((line) => line.startsWith(`${key}\t`));
  return matches.length === 1 ? matches[0]!.slice(key.length + 1) : undefined;
}

function completeContractLabels(contract: string): boolean {
  return CONTRACT_LABELS.every((label) => {
    const matches = contract
      .split(/\r?\n/)
      .filter((line) => line.startsWith(`${label}: `));
    return matches.length === 1 && !!matches[0]!.slice(label.length + 2).trim();
  });
}

function contractDimensionChecks(
  contract: string,
  route: string,
): Array<[string, boolean]> {
  return [
    [
      "format",
      recordValue(contract, "format") === "darrow-native-goal-preflight-v4",
    ],
    [
      "workflow",
      /^(?:fix-bug|implement-feature|change-feature|refactor|migration|mechanical)$/.test(
        recordValue(contract, "workflow") ?? "",
      ),
    ],
    [
      "risk",
      /^(?:routine|elevated|high)$/.test(recordValue(contract, "risk") ?? ""),
    ],
    [
      "profile",
      /^(?:routine|routine-plus|scaled|repo-wide|judgment)$/.test(
        recordValue(contract, "profile") ?? "",
      ),
    ],
    ["selected_route", recordValue(contract, "selected_route") === route],
    ["effective_route", recordValue(contract, "effective_route") === route],
  ];
}

function contractBoundaryChecks(contract: string): Array<[string, boolean]> {
  return [
    [
      "route_applied_by",
      recordValue(contract, "route_applied_by") === "native-subagent",
    ],
    ["route_verified", recordValue(contract, "route_verified") === "true"],
    [
      "launch_boundary",
      recordValue(contract, "launch_boundary") === "native_subagent",
    ],
    [
      "verification_gate",
      recordValue(contract, "verification_gate") ===
        recordValue(contract, "risk"),
    ],
    [
      "evaluation_child_invocations",
      recordValue(contract, "evaluation_child_invocations") === "1",
    ],
    [
      "evaluation_human_interruptions",
      recordValue(contract, "evaluation_human_interruptions") === "0",
    ],
    [
      "record_order",
      contract.indexOf("format\tdarrow-native-goal-preflight-v4") >
        contract.indexOf("Completion report: "),
    ],
  ];
}

function contractRecordIssues(
  contract: string,
  model: string,
  effort: string,
): string[] {
  const route = `codex\topenai\t${model}\t${effort}`;
  const checks: Array<[string, boolean]> = [
    ["contract_labels", completeContractLabels(contract)],
    ...contractDimensionChecks(contract, route),
    ...contractBoundaryChecks(contract),
  ];
  return checks.filter(([, valid]) => !valid).map(([name]) => name);
}

function fileBackedContractReference(
  objective: string,
): { path: string; sha256: string } | undefined {
  const lines = objective.split(/\r?\n/);
  const path = lines[1] ?? "";
  const expected =
    lines[2]?.match(/^Expected SHA-256: ([0-9a-f]{64})$/)?.[1] ?? "";
  const valid = [
    lines.length === 8,
    lines[0] === "Before doing any work, read the complete goal contract at:",
    lines[3] === "Verify the file digest before following the contract.",
    lines[4] ===
      "If the file is missing, unreadable, or does not match, stop and report the evidence gap.",
    lines[5] ===
      "This accepted ownership-marked task already makes you the sole goal owner; execute the contract directly even when no inner goal-control tool exists.",
    lines[6] === "Follow that complete contract through terminal completion.",
    lines[7] === "",
    path.startsWith("/"),
    !!expected,
  ].every(Boolean);
  return valid ? { path, sha256: expected } : undefined;
}

function fileBackedObjectivePath(body: string): string | undefined {
  const match = body.match(/^- objective_file: (\/[^\r\n]+)$/);
  return match?.[1];
}

interface ResolvedContract {
  contract: string;
  objectiveMode: "inline" | "file-backed";
  attachmentDir?: string;
}

async function validFileBackedContract(
  reference: { path: string; sha256: string },
  objectiveRoot: string,
): Promise<ResolvedContract | undefined> {
  const root = resolve(objectiveRoot);
  const attachmentDir = dirname(reference.path);
  const entries = (await readdir(attachmentDir)).sort();
  const stats = await Promise.all([
    lstat(reference.path),
    lstat(join(attachmentDir, "goal-objective.txt")),
  ]);
  const valid = [
    dirname(attachmentDir) === root,
    basename(attachmentDir).startsWith("darrow-goal-contract."),
    reference.path === join(attachmentDir, "goal-contract.md"),
    entries.join("\n") === "goal-contract.md\ngoal-objective.txt",
    stats.every((stat) => stat.isFile()),
  ].every(Boolean);
  if (!valid) return undefined;
  const contract = await readFile(reference.path, "utf8");
  return sha256(contract) === reference.sha256
    ? { contract, objectiveMode: "file-backed", attachmentDir }
    : undefined;
}

async function resolvedContract(
  body: string,
  objectiveRoot: string,
): Promise<ResolvedContract | undefined> {
  const objectivePath = fileBackedObjectivePath(body);
  if (!objectivePath) {
    return (await readdir(objectiveRoot)).length === 0
      ? { contract: body, objectiveMode: "inline" }
      : undefined;
  }
  try {
    const objective = await readFile(objectivePath, "utf8");
    const reference = fileBackedContractReference(objective);
    if (
      !reference ||
      objectivePath !== join(dirname(reference.path), "goal-objective.txt")
    )
      return undefined;
    return await validFileBackedContract(reference, objectiveRoot);
  } catch {
    return undefined;
  }
}

function ownerInput(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return undefined;
  const record = input as Record<string, unknown>;
  return typeof record.message === "string" &&
    record.message.startsWith(`${OWNER_MARKER}\n`)
    ? record
    : undefined;
}

function denied(reason: string): Record<string, unknown> {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

function signedState(state: CodexSpawnGuardState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}\n`;
}

async function readGuardState(
  policy: CodexSpawnGuardPolicy,
): Promise<CodexSpawnGuardState | undefined> {
  try {
    const proof = (await readFile(policy.statePath, "utf8")).trim();
    const separator = proof.lastIndexOf(".");
    if (separator < 1) return undefined;
    const payload = proof.slice(0, separator);
    const signature = proof.slice(separator + 1);
    const expected = createHmac("sha256", policy.secret)
      .update(payload)
      .digest("hex");
    if (signature !== expected) return undefined;
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as CodexSpawnGuardState;
  } catch {
    return undefined;
  }
}

function hookTurnId(hook: Record<string, unknown>): string | undefined {
  return typeof hook.turn_id === "string" && hook.turn_id
    ? hook.turn_id
    : undefined;
}

function concreteSpawnRoute(
  input: Record<string, unknown>,
): { model: string; effort: string } | undefined {
  if (typeof input.model !== "string" || !input.model) return undefined;
  if (typeof input.reasoning_effort !== "string" || !input.reasoning_effort)
    return undefined;
  if (input.fork_turns !== undefined && input.fork_turns !== "none")
    return undefined;
  return { model: input.model, effort: input.reasoning_effort };
}

function attestationLine(
  attestation: CodexSpawnAttestation,
  secret: string,
): string {
  const payload = Buffer.from(JSON.stringify(attestation)).toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${ATTESTATION_PREFIX}${payload}.${signature}`;
}

async function ownerBoundaryIssue(
  cwd: string,
  policy: CodexSpawnGuardPolicy,
): Promise<string | undefined> {
  if ((await repositoryFingerprint(cwd)) !== policy.baselineSha256)
    return "parent worktree changed before adaptive goal owner activation";
  if ((await fixtureStateFingerprint(cwd)) !== policy.fixtureStateSha256)
    return "parent fixture state changed before adaptive goal owner activation";
  return undefined;
}

function spawnAttestation(
  route: { model: string; effort: string },
  body: string,
  resolved: ResolvedContract,
  policy: CodexSpawnGuardPolicy,
): CodexSpawnAttestation {
  return {
    model: route.model,
    effort: route.effort,
    forkTurns: "none",
    requestSha256: policy.requestSha256,
    objectiveSha256: sha256(body),
    contractSha256: sha256(resolved.contract),
    baselineSha256: policy.baselineSha256,
    fixtureStateSha256: policy.fixtureStateSha256,
    objectiveMode: resolved.objectiveMode,
    ...(resolved.attachmentDir
      ? { attachmentDir: resolved.attachmentDir }
      : {}),
  };
}

function allowedSpawn(
  input: Record<string, unknown>,
  message: string,
  attestation: CodexSpawnAttestation,
  secret: string,
): Record<string, unknown> {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: {
        ...input,
        fork_turns: "none",
        message: `${message}\n${attestationLine(attestation, secret)}`,
      },
    },
  };
}

export async function guardCodexSpawn(
  hookInput: unknown,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown> | undefined> {
  if (!hookInput || typeof hookInput !== "object" || Array.isArray(hookInput))
    return denied("malformed Codex hook input");
  const hook = hookInput as Record<string, unknown>;
  const toolName =
    typeof hook.tool_name === "string" ? hook.tool_name : "Agent";
  if (toolName === "Bash") return guardParentShell(hook, policy);
  if (toolName === "apply_patch") return guardParentPatch(hook, policy);
  const input = ownerInput(hook.tool_input);
  if (!input) return guardUnmarkedAgent(hook, policy);
  return guardOwnerAgent(hook, input, policy);
}

async function guardOwnerAgent(
  hook: Record<string, unknown>,
  input: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown>> {
  if (await readGuardState(policy))
    return denied(
      "adaptive goal owner activation was already attempted; retries are forbidden",
    );
  const route = concreteSpawnRoute(input);
  const message = input.message as string;
  if (!route)
    return denied(
      "adaptive goal owner requires concrete model and effort without a conflicting fork_turns value",
    );
  const cwd = String(hook.cwd ?? "");
  const boundaryIssue = await ownerBoundaryIssue(cwd, policy);
  if (boundaryIssue) return denied(boundaryIssue);
  const body = message.slice(OWNER_MARKER.length + 1);
  const resolved = await resolvedContract(body, policy.objectiveRoot);
  if (!resolved)
    return denied(
      "adaptive goal owner objective was not a valid inline or file-backed contract",
    );
  const contractIssues = contractRecordIssues(
    resolved.contract,
    route.model,
    route.effort,
  );
  if (contractIssues.length)
    return denied(
      `adaptive goal owner contract has invalid fields: ${contractIssues.join(", ")}`,
    );
  const attestation = spawnAttestation(route, body, resolved, policy);
  const parentTurnId = hookTurnId(hook);
  if (!parentTurnId)
    return denied("adaptive goal owner spawn has no host turn identity");
  try {
    await writeFile(
      policy.statePath,
      signedState({ parentTurnId, attestation }, policy.secret),
      { mode: 0o600, flag: "wx" },
    );
  } catch {
    return denied(
      "adaptive goal owner activation state could not be established; retry is forbidden",
    );
  }
  return allowedSpawn(input, message, attestation, policy.secret);
}

async function guardUnmarkedAgent(
  hook: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown> | undefined> {
  const state = await readGuardState(policy);
  const turn = hookTurnId(hook);
  if (state && turn && turn !== state.parentTurnId) return undefined;
  return denied(
    "only the ownership-marked adaptive goal Agent may start from the parent thread",
  );
}

function shellCommand(hook: Record<string, unknown>): string | undefined {
  const input = hook.tool_input;
  if (!input || typeof input !== "object" || Array.isArray(input))
    return undefined;
  const command = (input as Record<string, unknown>).command;
  return typeof command === "string" ? command.trim() : undefined;
}

function parentLifecycleShellAllowed(
  command: string,
  state: CodexSpawnGuardState,
  policy: CodexSpawnGuardPolicy,
): boolean {
  if (/^(?:[^\s/]+\/)*feedbackctl answer [A-Za-z0-9._-]+$/.test(command))
    return true;
  const attachment = state.attestation.attachmentDir;
  if (!attachment) return false;
  return (
    command ===
    `/bin/bash ${policy.goalLoopPath} release-objective --attachment-dir ${attachment} --expected-sha256 ${state.attestation.contractSha256}`
  );
}

async function guardParentShell(
  hook: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown> | undefined> {
  const command = shellCommand(hook);
  if (!command) return denied("malformed parent shell command");
  const state = await readGuardState(policy);
  const turn = hookTurnId(hook);
  if (state && turn !== state.parentTurnId) return undefined;
  if (state)
    return parentLifecycleShellAllowed(command, state, policy)
      ? undefined
      : denied(
          "parent shell commands are forbidden after goal owner activation",
        );
  if (
    /\b(?:test\.sh|independent-review-fixture)\b|\b(?:bun|npm|pnpm)\s+(?:run\s+)?test\b|\bnode\s+--test\b/.test(
      command,
    )
  )
    return denied(
      "the classifier cannot execute verification or review before activation",
    );
  return undefined;
}

function patchTarget(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return undefined;
  const patch = (input as Record<string, unknown>).command;
  if (typeof patch !== "string") return undefined;
  const targets = [
    ...patch.matchAll(/^\*\*\* (Add|Update|Delete) File: (.+)$/gm),
  ];
  return targets.length === 1 && targets[0]![1] === "Add"
    ? targets[0]![2]
    : undefined;
}

async function guardParentPatch(
  hook: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown> | undefined> {
  const state = await readGuardState(policy);
  const turn = hookTurnId(hook);
  if (state && turn !== state.parentTurnId) return undefined;
  if (state)
    return denied(
      "parent file changes are forbidden after goal owner activation",
    );
  const target = patchTarget(hook.tool_input);
  const root = `${resolve(policy.objectiveRoot)}/`;
  return target && resolve(target).startsWith(root)
    ? undefined
    : denied(
        "the classifier may write only one private objective staging file",
      );
}

function finalAttestationProof(lines: string[]): string | undefined {
  const proofs = lines.filter((line) => line.startsWith(ATTESTATION_PREFIX));
  if (proofs.length !== 1 || lines.at(-1) !== proofs[0]) return undefined;
  return proofs[0]!.slice(ATTESTATION_PREFIX.length);
}

function decodedAttestation(
  proof: string,
  secret: string,
): Record<string, unknown> | undefined {
  const separator = proof.lastIndexOf(".");
  if (separator < 1) return undefined;
  const payload = proof.slice(0, separator);
  const signature = proof.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (signature !== expected) return undefined;
  try {
    const value = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function validAttestation(
  record: Record<string, unknown>,
  body: string,
): boolean {
  return [
    typeof record.model === "string",
    typeof record.effort === "string",
    record.forkTurns === "none",
    /^[0-9a-f]{64}$/.test(String(record.requestSha256 ?? "")),
    record.objectiveSha256 === sha256(body),
    /^[0-9a-f]{64}$/.test(String(record.contractSha256 ?? "")),
    /^[0-9a-f]{64}$/.test(String(record.baselineSha256 ?? "")),
    /^[0-9a-f]{64}$/.test(String(record.fixtureStateSha256 ?? "")),
    record.objectiveMode === "inline" || record.objectiveMode === "file-backed",
    record.objectiveMode !== "file-backed" ||
      (typeof record.attachmentDir === "string" &&
        record.attachmentDir.startsWith("/")),
  ].every(Boolean);
}

export function verifiedCodexSpawnAttestation(
  prompt: string,
  secret: string,
): CodexSpawnAttestation | undefined {
  const lines = prompt.split(/\r?\n/);
  const proof = finalAttestationProof(lines);
  if (!proof) return undefined;
  const record = decodedAttestation(proof, secret);
  if (!record) return undefined;
  const body = lines.slice(1, -1).join("\n");
  return validAttestation(record, body)
    ? (record as unknown as CodexSpawnAttestation)
    : undefined;
}

async function readStdin(): Promise<unknown> {
  return JSON.parse(await new Response(Bun.stdin.stream()).text());
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      secret: { type: "string" },
      baseline: { type: "string" },
      "fixture-state": { type: "string" },
      request: { type: "string" },
      "objective-root": { type: "string" },
      "goal-loop": { type: "string" },
      state: { type: "string" },
    },
  });
  if (
    !values.secret ||
    !values.baseline ||
    !values["fixture-state"] ||
    !values.request ||
    !values["objective-root"] ||
    !values["goal-loop"] ||
    !values.state
  )
    process.exit(64);
  const result = await guardCodexSpawn(await readStdin(), {
    secret: values.secret,
    baselineSha256: values.baseline,
    fixtureStateSha256: values["fixture-state"],
    requestSha256: values.request,
    objectiveRoot: values["objective-root"],
    goalLoopPath: values["goal-loop"],
    statePath: values.state,
  });
  if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
}
