import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { Dirent } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import type {
  HarnessAdapter,
  HarnessResult,
  HarnessRunRequest,
  SkillActivationProbe,
  SkillActivationObservation,
} from "../types";
import { sandboxedAgentCommand } from "../sandbox";
import { throwIfInterrupted, trackEvaluationProcess } from "../run-control";
import { isolatedHarnessEnvironment } from "../environment";
import { codexAgentConcurrencyEvidence } from "../codex-config";
import {
  fixtureStateFingerprint,
  repositoryFingerprint,
  verifiedCodexAcceptedOwner,
  verifiedCodexSpawnAttestation,
} from "../codex-spawn-guard";
import { CODEX_EVAL_ROLE_DEFAULTS } from "../model-defaults";
import { retainedCodexGoalControls } from "./codex-goal-tools";
import {
  reviewAxesFromTaskName,
  type ReviewAxis,
} from "../native-review-proof";

type AcceptedCodexOwner = NonNullable<
  Awaited<ReturnType<typeof verifiedCodexAcceptedOwner>>
>;

const CODEX_AGENT_REF =
  /^(?:\/root(?:\/[a-z0-9_]+)+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

interface CodexUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface CodexEvent {
  type?: unknown;
  thread_id?: unknown;
  usage?: CodexUsage;
  msg?: { type?: unknown; info?: { total_token_usage?: CodexUsage } };
  info?: { total_token_usage?: CodexUsage };
  item?: {
    id?: unknown;
    type?: unknown;
    command?: unknown;
    exit_code?: unknown;
    status?: unknown;
    aggregated_output?: unknown;
    tool?: unknown;
    prompt?: unknown;
    sender_thread_id?: unknown;
    senderThreadId?: unknown;
    receiver_thread_ids?: unknown;
    receiverThreadIds?: unknown;
    task_name?: unknown;
    taskName?: unknown;
    model?: unknown;
    reasoning_effort?: unknown;
    reasoningEffort?: unknown;
    fork_turns?: unknown;
    forkTurns?: unknown;
  };
  tool_response?: unknown;
  result?: unknown;
  [key: string]: unknown;
}

/** JSONL events from the `codex exec --json` stream; non-JSON noise is fine. */
function codexEvents(stream: string): CodexEvent[] {
  const events: CodexEvent[] = [];
  for (const line of stream.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      events.push(JSON.parse(trimmed) as CodexEvent);
    } catch {
      // non-JSON noise in the stream is fine
    }
  }
  return events;
}

export function codexThreadId(stream: string): string | undefined {
  const ids = [
    ...new Set(
      codexEvents(stream).flatMap((event) =>
        event.type === "thread.started" && typeof event.thread_id === "string"
          ? [event.thread_id]
          : [],
      ),
    ),
  ];
  return ids.length === 1 ? ids[0] : undefined;
}

function codexStreamMalformed(stream: string): boolean {
  return stream.split("\n").some((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) return false;
    try {
      JSON.parse(trimmed);
      return false;
    } catch {
      return true;
    }
  });
}

function codexEventTypes(event: CodexEvent): string[] {
  return [event.type, event.msg?.type].filter(
    (type): type is string => typeof type === "string",
  );
}

export function codexRunSucceeded(code: number, stream: string): boolean {
  let completed = false;
  let failed = false;
  for (const event of codexEvents(stream)) {
    const types = codexEventTypes(event);
    if (types.includes("turn.completed")) completed = true;
    if (types.includes("turn.failed")) failed = true;
  }
  return code === 0 && completed && !failed;
}

function completedCommand(event: CodexEvent): string | undefined {
  if (
    event.type !== "item.completed" ||
    event.item?.type !== "command_execution" ||
    typeof event.item.command !== "string" ||
    event.item.exit_code !== 0 ||
    event.item.status !== "completed"
  )
    return undefined;
  return event.item.command;
}

function finishedCommandForSkillRead(event: CodexEvent): string | undefined {
  if (
    event.type !== "item.completed" ||
    event.item?.type !== "command_execution" ||
    typeof event.item.command !== "string" ||
    typeof event.item.exit_code !== "number" ||
    (event.item.status !== "completed" && event.item.status !== "failed")
  )
    return undefined;
  return event.item.command;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shellPayload(command: string): string | undefined {
  const wrapper = command.match(
    /^\/bin\/(?:ba|z)?sh\s+-l?c\s+(["'])([\s\S]*)\1$/,
  );
  return wrapper?.[2] ?? command;
}

const SKILL_BODY_READERS = new Set([
  "awk",
  "bat",
  "cat",
  "ctx_read",
  "cut",
  "dd",
  "grep",
  "head",
  "lean-ctx",
  "less",
  "more",
  "rg",
  "sed",
  "tail",
]);

const READ_DIAGNOSTIC_HEADS = new Set([
  ...SKILL_BODY_READERS,
  "for",
  "do",
  "done",
  "if",
  "then",
  "else",
  "fi",
  "while",
  "find",
  "xargs",
  "sh",
  "bash",
  "zsh",
  "test",
  "printf",
  "echo",
  "cd",
]);

function shellClauseExecutable(part: string): string | undefined {
  let clause = part.trim();
  while (clause) {
    const assignment = clause.match(
      /^(?:(?:export|local|readonly)\s+)?[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)(?:\s+|$)/,
    );
    if (!assignment) break;
    clause = clause.slice(assignment[0].length).trimStart();
  }
  clause = clause.replace(/^(?:command|env)\s+/, "");
  const token = clause.match(/^["']?([^\s"']+)/)?.[1];
  return token?.split("/").at(-1);
}

function replaceShellVariable(
  value: string,
  name: string,
  replacement: string,
): string {
  return value.replace(
    new RegExp(`\\$\\{${name}\\}|\\$${name}(?![A-Za-z0-9_])`, "g"),
    () => replacement,
  );
}

function expandSimpleShellVariables(payload: string): string {
  const values = new Map<string, string>();
  const assignments =
    /(?:^|[;&|\n]\s*)(?:(?:export|local|readonly)\s+)?([A-Za-z_][A-Za-z0-9_]*)=(?:"([^"`]*)"|'([^']*)'|((?!\$\()[^\s;&|)]+))/g;
  for (const match of payload.matchAll(assignments)) {
    const name = match[1];
    const raw = match[2] ?? match[3] ?? match[4];
    if (!name || raw === undefined) continue;
    let value = raw;
    if (match[3] === undefined)
      for (const [knownName, knownValue] of values)
        value = replaceShellVariable(value, knownName, knownValue);
    if (!/[`\r\n]/.test(value)) values.set(name, value);
  }
  let expanded = payload;
  for (const [name, value] of values)
    expanded = replaceShellVariable(expanded, name, value);
  return expanded;
}

function skillBodyReadClauses(payload: string): string[] {
  return payload
    .split(/&&|\|\||[;|\n]/)
    .map((part) => part.replace(/^\s*(?:then|else)\s+/, ""))
    .filter((part) => {
      const executable = shellClauseExecutable(part);
      return executable ? SKILL_BODY_READERS.has(executable) : false;
    });
}

function skillReads(command: string, skillsRoot: string): string[] {
  const path = new RegExp(
    `(?:^|[^A-Za-z0-9._/-])(?:\\./)?${escapeRegExp(skillsRoot)}/([A-Za-z0-9._-]+)/SKILL\\.md(?=$|[^A-Za-z0-9._/-])`,
    "g",
  );
  const payload = shellPayload(command);
  if (!payload) return [];
  return [...payload.matchAll(path)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

interface MountedSkillBody {
  name: string;
  frontmatter: string;
  body: string;
}

function mountedSkillBody(
  root: string,
  entry: Dirent,
): MountedSkillBody | undefined {
  if (!entry.isDirectory() || !/^[A-Za-z0-9._-]+$/.test(entry.name))
    return undefined;
  let body: string;
  try {
    body = readFileSync(join(root, entry.name, "SKILL.md"), "utf8");
  } catch {
    return undefined;
  }
  const frontmatter = body.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0];
  if (
    !frontmatter ||
    !new RegExp(
      `(?:^|\\n)name:\\s*${escapeRegExp(entry.name)}\\s*(?:\\n|$)`,
    ).test(frontmatter)
  )
    return undefined;
  return { name: entry.name, frontmatter, body };
}

function mountedSkillBodies(
  repoDir: string,
  installedSkillsRoot: string | string[],
): MountedSkillBody[] {
  const installedRoots = Array.isArray(installedSkillsRoot)
    ? installedSkillsRoot
    : [installedSkillsRoot];
  const roots = [
    ...new Set([
      ...installedRoots.map((root) =>
        isAbsolute(root) ? root : resolve(repoDir, root),
      ),
      join(repoDir, ".agents", "skills"),
    ]),
  ];
  const bodies: MountedSkillBody[] = [];
  for (const root of roots) {
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const skill = mountedSkillBody(root, entry);
      if (skill) bodies.push(skill);
    }
  }
  return bodies;
}

function commandReferencesPath(command: string, path: string): boolean {
  return new RegExp(
    `(?:^|[^A-Za-z0-9._/-])(?:\\./)?${escapeRegExp(path)}(?=$|/|[^A-Za-z0-9._/-])`,
  ).test(command);
}

function cdFeedsSkillRead(
  payload: string,
  skillsRoots: string[],
  skill: string,
): boolean {
  let inSkillDirectory = false;
  for (const clause of payload.split(/&&|;|\n/)) {
    if (shellClauseExecutable(clause) === "cd") {
      inSkillDirectory = skillsRoots.some((root) =>
        commandReferencesPath(clause, `${root}/${skill}`),
      );
      continue;
    }
    if (
      inSkillDirectory &&
      skillBodyReadClauses(clause).length > 0 &&
      /(?:^|[^A-Za-z0-9._-])SKILL\.md(?=$|[^A-Za-z0-9._-])/.test(clause)
    )
      return true;
  }
  return false;
}

function commandSubstitutionFeedsSkillRead(
  payload: string,
  skillsRoots: string[],
): boolean {
  const assignment = /([A-Za-z_][A-Za-z0-9_]*)=\$\(([\s\S]*?)\)/g;
  for (const match of payload.matchAll(assignment)) {
    const variable = match[1];
    const discovery = match[2];
    if (!variable || !discovery) continue;
    const rooted = skillsRoots.some((root) =>
      commandReferencesPath(discovery, root),
    );
    if (
      !rooted ||
      !/(?:^|[^A-Za-z0-9._-])SKILL\.md(?=$|[^A-Za-z0-9._-])/.test(discovery)
    )
      continue;
    const tail = payload.slice((match.index ?? 0) + match[0].length);
    if (
      skillBodyReadClauses(tail).some((clause) =>
        new RegExp(
          `\\$\\{${escapeRegExp(variable)}\\}|\\$${escapeRegExp(variable)}(?![A-Za-z0-9_])`,
        ).test(clause),
      )
    )
      return true;
  }
  return false;
}

function simpleLoopBodyReadsVariable(body: string, variable: string): boolean {
  if (/[;&|\r\n]/.test(body)) return false;
  if (!SKILL_BODY_READERS.has(shellClauseExecutable(body) ?? "")) return false;
  if (new RegExp(`\\b${variable}\\s*=`).test(body)) return false;
  return new RegExp(
    `(?:^|\\s)"?\\$(?:\\{${variable}\\}|${variable})"?(?=\\s|$)`,
  ).test(body);
}

function namesLoopVariable(operand: string, variable: string): boolean {
  return [`$${variable}`, `\${${variable}}`].some(
    (reference) => operand === reference || operand === `"${reference}"`,
  );
}

function labeledLoopBodyReadsVariable(body: string, variable: string): boolean {
  if (simpleLoopBodyReadsVariable(body, variable)) return true;
  const clauses = body.split(/[;\r\n]/).map((part) => part.trim());
  if (clauses.length !== 2) return false;
  const header = clauses[0]!.match(
    /^printf\s+(?:'([^']*)'|"([^"$`]*)")\s+(.+)$/,
  );
  if (!header || !namesLoopVariable(header[3]!, variable)) return false;
  const format = header[1] ?? header[2]!;
  // One filename substitution surrounded only by bounded separator characters.
  // Never accept dynamic formats, extra arguments, escapes that render data,
  // or literal skill text as a substitute for the actual reader's output.
  if (format.length > 80 || format.split("%s").length !== 2) return false;
  const separator = format.replace("%s", "").replace(/\\[nrt]/g, "");
  if (!/^[ \t#=[\]():.-]*$/.test(separator)) return false;
  return simpleLoopBodyReadsVariable(clauses[1]!, variable);
}

function guardedLoopBodyReadsVariable(body: string, variable: string): boolean {
  if (labeledLoopBodyReadsVariable(body, variable)) return true;
  const conditional = body.match(
    /^if\s+([^;\n]+)[;\n]\s*then\s+([\s\S]*?)[;\n]\s*fi$/,
  );
  if (!conditional) return false;
  const guard = conditional[1]!
    .trim()
    .match(/^(?:test\s+-[fr]\s+(.+)|\[\s+-[fr]\s+(.+)\s+\])$/);
  if (!guard) return false;
  const operand = (guard[1] ?? guard[2])!.trim();
  return (
    namesLoopVariable(operand, variable) &&
    labeledLoopBodyReadsVariable(conditional[2]!.trim(), variable)
  );
}

function pathnamePattern(word: string): RegExp | undefined {
  // Only pathname expansion: never execute substitutions or interpret shell
  // operators. Quotes preserve literal wildcard characters, including spaces.
  if (/[$`\\()[\]{}<>;&|]/.test(word)) return undefined;
  let quote: string | undefined;
  let pattern = "";
  for (const character of word) {
    if (quote) {
      if (character === quote) quote = undefined;
      else pattern += escapeRegExp(character);
    } else if (character === '"' || character === "'") quote = character;
    else
      pattern += pathnamePatternCharacter(
        character,
        !pattern || pattern.endsWith("/"),
      );
  }
  return quote ? undefined : new RegExp(`^${pattern}$`);
}

function pathnamePatternCharacter(
  character: string,
  startsComponent: boolean,
): string {
  const visible = startsComponent ? "(?!\\.)" : "";
  if (character === "*") return `${visible}[^/]*`;
  if (character === "?") return `${visible}[^/]`;
  return escapeRegExp(character);
}

function pathnameLoopBindsSkill(
  paths: string,
  roots: string[],
  skill: string,
): boolean {
  const token = /(?:'[^']*'|"[^"]*"|[^\s'"])+/g;
  if (paths.replace(token, "").trim()) return false;
  const patterns = [...paths.matchAll(token)].map((match) =>
    pathnamePattern(match[0]),
  );
  if (patterns.some((pattern) => !pattern)) return false;
  return roots.some((root) => {
    const path = `${root}/${skill}/SKILL.md`;
    return patterns.some(
      (pattern) =>
        pattern!.test(path) ||
        (!isAbsolute(root) && pattern!.test(`./${path}`)),
    );
  });
}

function pathnameLoopFeedsSkillRead(
  payload: string,
  roots: string[],
  skill: string,
): boolean {
  // Bind literal/glob path words to a mounted file and one variable-consuming
  // reader, optionally guarded by that same file's existence/readability.
  // Other loop mutation, control flow, and dynamic expansion stay unrecognized.
  const loops =
    /(?:^|[;\n])\s*for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([^;\n]+)[;\n]\s*do\s+([\s\S]*?)[;\n]\s*done\b/g;
  for (const match of payload.matchAll(loops)) {
    const [, variable, paths, body] = match;
    if (!variable || !paths || !body) continue;
    if (
      pathnameLoopBindsSkill(paths, roots, skill) &&
      guardedLoopBodyReadsVariable(body.trim(), variable)
    )
      return true;
  }
  return false;
}

function indirectSkillReads(
  command: string,
  output: string,
  skillsRoots: string[],
  mountedSkills: MountedSkillBody[],
): string[] {
  const payload = shellPayload(command);
  if (!payload) return [];
  const expanded = expandSimpleShellVariables(payload);
  const rootedRead = skillBodyReadClauses(expanded).some(
    (clause) =>
      /(?:^|[^A-Za-z0-9._-])SKILL\.md(?=$|[^A-Za-z0-9._-])/.test(clause) &&
      skillsRoots.some((root) => commandReferencesPath(clause, root)),
  );
  const substitutionRead = commandSubstitutionFeedsSkillRead(
    expanded,
    skillsRoots,
  );
  return mountedSkills
    .flatMap((skill) => {
      const outputOffset = output.indexOf(skill.frontmatter);
      const workingDirectoryRead = cdFeedsSkillRead(
        expanded,
        skillsRoots,
        skill.name,
      );
      return outputOffset >= 0 &&
        (rootedRead ||
          substitutionRead ||
          workingDirectoryRead ||
          pathnameLoopFeedsSkillRead(expanded, skillsRoots, skill.name))
        ? [{ name: skill.name, outputOffset }]
        : [];
    })
    .sort((left, right) => left.outputOffset - right.outputOffset)
    .map(({ name }) => name);
}

function malformedCompletedCommand(event: CodexEvent): boolean {
  if (
    event.type !== "item.completed" ||
    event.item?.type !== "command_execution"
  )
    return false;
  return (
    typeof event.item.command !== "string" ||
    typeof event.item.exit_code !== "number" ||
    (event.item.status !== "completed" && event.item.status !== "failed")
  );
}

function eventSkillReads(
  event: CodexEvent,
  roots: string[],
  mountedSkills: MountedSkillBody[],
): string[] {
  const command = finishedCommandForSkillRead(event);
  if (!command) return [];
  const output = event.item?.aggregated_output;
  const payload = shellPayload(command);
  const directReads = payload
    ? skillBodyReadClauses(expandSimpleShellVariables(payload)).flatMap(
        (clause) =>
          roots.flatMap((skillsRoot) => skillReads(clause, skillsRoot)),
      )
    : [];
  const mountedNames = new Set(mountedSkills.map(({ name }) => name));
  const verifiedDirectReads = mountedNames.size
    ? directReads.filter((skill) => mountedNames.has(skill))
    : directReads;
  return [
    ...verifiedDirectReads,
    ...(typeof output === "string"
      ? indirectSkillReads(command, output, roots, mountedSkills)
      : []),
  ];
}

interface SkillReadEvidence {
  output: string;
  ranges: Array<[number, number]>;
}

function observedSkillReads(
  events: CodexEvent[],
  skillsRoots: string | string[],
  mountedSkills: MountedSkillBody[] = [],
  options: {
    initialSkills?: string[];
    readEvidence?: Map<string, SkillReadEvidence>;
  } = {},
): string[] {
  const roots = [skillsRoots].flat();
  const observedSkills = [...(options.initialSkills ?? [])];
  const readEvidence =
    options.readEvidence ?? new Map<string, SkillReadEvidence>();
  for (const event of events) {
    const output = event.item?.aggregated_output;
    const skills = eventSkillReads(event, roots, mountedSkills);
    for (const skill of skills) {
      if (observedSkills.includes(skill)) continue;
      const accumulated = accumulatedSkillOutput(
        skill,
        output,
        mountedSkills,
        readEvidence,
      );
      if (skillReadIsObservable(skill, accumulated, mountedSkills))
        observedSkills.push(skill);
    }
  }
  return observedSkills;
}

function accumulatedSkillOutput(
  skill: string,
  output: unknown,
  mountedSkills: MountedSkillBody[],
  evidence: Map<string, SkillReadEvidence>,
): unknown {
  const mounted = mountedSkills.find((candidate) => candidate.name === skill);
  if (typeof output !== "string" || !mounted) return output;
  const previous = evidence.get(skill) ?? { output: "", ranges: [] };
  const accumulated = (previous.output + output).slice(
    -Math.max(mounted.body.length * 4, 65536),
  );
  const merged = mergedSkillPageRanges(mounted.body, output, previous.ranges);
  evidence.set(skill, { output: accumulated, ranges: merged });
  return merged.length === 1 &&
    merged[0]![0] === 0 &&
    merged[0]![1] === mounted.body.length
    ? mounted.body
    : accumulated;
}

function mergedSkillPageRanges(
  body: string,
  output: string,
  previous: Array<[number, number]>,
): Array<[number, number]> {
  // Only uniquely located exact slices contribute coverage, never inferred gaps.
  const ranges = [...previous];
  const start = output.length ? body.indexOf(output) : -1;
  if (start >= 0 && body.lastIndexOf(output) === start)
    ranges.push([start, start + output.length]);
  else ranges.push(...embeddedSkillPageRanges(body, output));
  ranges.sort((left, right) => left[0] - right[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

function embeddedSkillPageRanges(
  body: string,
  output: string,
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const anchorSize = 64;
  for (let start = 0; start + anchorSize <= body.length; start += anchorSize) {
    if ((ranges.at(-1)?.[1] ?? 0) >= start + anchorSize) continue;
    const anchor = body.slice(start, start + anchorSize);
    if (body.indexOf(anchor) !== start || body.lastIndexOf(anchor) !== start)
      continue;
    const offset = output.indexOf(anchor);
    if (offset < 0) continue;
    ranges.push(
      extendExactSkillPage(body, output, { start, offset, anchorSize }),
    );
  }
  return ranges;
}

function extendExactSkillPage(
  body: string,
  output: string,
  anchor: { start: number; offset: number; anchorSize: number },
): [number, number] {
  const { start, offset, anchorSize } = anchor;
  let left = start;
  let right = start + anchorSize;
  const delta = offset - start;
  while (
    left > 0 &&
    left + delta > 0 &&
    body[left - 1] === output[left + delta - 1]
  )
    left--;
  while (right < body.length && body[right] === output[right + delta]) right++;
  return [left, right];
}

function skillReadIsObservable(
  skill: string,
  output: unknown,
  mountedSkills: MountedSkillBody[],
): boolean {
  if (typeof output !== "string") return false;
  const hasFrontmatter = new RegExp(
    `(?:^|\\n)---\\nname:\\s*${escapeRegExp(skill)}(?:\\n|$)`,
  ).test(output);
  if (!hasFrontmatter) return false;
  const mounted = mountedSkills.find((candidate) => candidate.name === skill);
  return !mounted || output.includes(mounted.body);
}

function codexTrackedSkillRoots(
  repoDir: string,
  installedSkillsRoot: string | string[],
): string[] {
  const installedSkillsRoots = Array.isArray(installedSkillsRoot)
    ? installedSkillsRoot
    : [installedSkillsRoot];
  const repoRelativeInstalledRoots = installedSkillsRoots.flatMap(
    (skillsRoot) => {
      if (!isAbsolute(skillsRoot)) return [];
      const repoRelativeRoot = relative(repoDir, skillsRoot);
      if (
        !repoRelativeRoot ||
        repoRelativeRoot === ".." ||
        repoRelativeRoot.startsWith(`..${sep}`) ||
        isAbsolute(repoRelativeRoot)
      )
        return [];
      return [repoRelativeRoot];
    },
  );
  return [
    ...new Set([
      ...installedSkillsRoots,
      ...repoRelativeInstalledRoots,
      join(repoDir, ".agents", "skills"),
      join(".agents", "skills"),
    ]),
  ];
}

function codexActivationStreamComplete(
  stream: string,
  events: CodexEvent[],
): boolean {
  let completed = false;
  let failed = false;
  for (const event of events) {
    const types = codexEventTypes(event);
    if (types.includes("turn.completed")) completed = true;
    if (types.includes("turn.failed")) failed = true;
  }
  return (
    completed &&
    !failed &&
    !codexStreamMalformed(stream) &&
    !events.some(malformedCompletedCommand)
  );
}

function literalOccurrences(value: string, token: string): number {
  if (!token) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = value.indexOf(token, offset)) !== -1) {
    count++;
    offset += token.length;
  }
  return count;
}

/**
 * Codex resolves a runner-rendered explicit skill token before model execution,
 * so that dispatch is not repeated as a transcript-visible SKILL.md read. The
 * controlled probe is complete only when one exact expected token was supplied
 * to a successfully completed turn.
 */
export function codexExplicitSkillActivation(
  stream: string,
  prompt: string,
  probe: Extract<SkillActivationProbe, { mode: "explicit" }>,
  context?: { repoDir: string; installedSkillsRoots: string | string[] },
): SkillActivationObservation {
  const events = codexEvents(stream);
  const unambiguous =
    /^[A-Za-z0-9._-]+$/.test(probe.skill) &&
    probe.invocation.length > 0 &&
    literalOccurrences(prompt, probe.invocation) === 1;
  const complete = unambiguous && codexActivationStreamComplete(stream, events);
  const observation = complete
    ? explicitSkillReads(events, probe.skill, context)
    : { observedSkills: [], complete: false };
  return {
    source: "explicit_invocation",
    complete: observation.complete,
    primarySkill: observation.observedSkills[0] ?? null,
    observedSkills: observation.observedSkills,
  };
}

function explicitSkillReads(
  events: CodexEvent[],
  primary: string,
  context:
    { repoDir: string; installedSkillsRoots: string | string[] } | undefined,
): { observedSkills: string[]; complete: boolean } {
  if (!context) return { observedSkills: [primary], complete: true };
  const mounted = mountedSkillBodies(
    context.repoDir,
    context.installedSkillsRoots,
  );
  const roots = codexTrackedSkillRoots(
    context.repoDir,
    context.installedSkillsRoots,
  );
  const isMounted = (skill: string) =>
    mounted.some(({ name }) => name === skill);
  const observedSkills = observedSkillReads(events, roots, mounted, {
    initialSkills: [primary],
  }).filter(
    (skill) => skill === primary || mounted.some(({ name }) => name === skill),
  );
  const attempted = events
    .flatMap((event) => eventSkillReads(event, roots, mounted))
    .filter(isMounted);
  return {
    observedSkills,
    complete: attempted.every((skill) => observedSkills.includes(skill)),
  };
}

/**
 * Codex exposes command events but no native skill-invocation event for
 * implicit discovery. The first completed mounted SKILL.md read is therefore
 * retained as an explicitly labeled behavior probe for implicit cases.
 */
export function codexSkillActivation(
  stream: string,
  repoDir: string,
  installedSkillsRoot: string | string[] = join(repoDir, ".agents", "skills"),
): SkillActivationObservation {
  const events = codexEvents(stream);
  const mountedSkills = mountedSkillBodies(repoDir, installedSkillsRoot);
  const observedSkills = observedSkillReads(
    events,
    codexTrackedSkillRoots(repoDir, installedSkillsRoot),
    mountedSkills,
  );
  return {
    source: "skill_file_read_probe",
    complete: codexActivationStreamComplete(stream, events),
    primarySkill: observedSkills[0] ?? null,
    observedSkills,
  };
}

function retainedTerminalEvent(event: CodexEvent): unknown | undefined {
  const types = codexEventTypes(event);
  const terminal = types.find(
    (type) => type === "turn.completed" || type === "turn.failed",
  );
  if (!terminal) return undefined;
  const usage = normalizedCodexUsage(codexUsageCandidate(event).value);
  return usage ? { type: terminal, usage } : { type: terminal };
}

function acceptedCollaborationEvent(event: CodexEvent): boolean {
  const item = event.item;
  if (item?.type !== "collab_tool_call" || typeof item.tool !== "string")
    return false;
  if (event.type === "item.completed")
    return item.tool === "spawn_agent" || item.status === "completed";
  return (
    event.type === "item.started" &&
    ["spawn_agent", "wait", "wait_agent"].includes(item.tool) &&
    item.status === "in_progress"
  );
}

function canonicalCodexAgentRef(value: unknown): string | undefined {
  return typeof value === "string" && CODEX_AGENT_REF.test(value)
    ? value
    : undefined;
}

function taskNameAgentRefs(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return [record.task_name, record.taskName]
    .map(canonicalCodexAgentRef)
    .filter((reference): reference is string => reference !== undefined);
}

function invalidTaskNameAgentRef(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ["task_name", "taskName"].some(
    (key) =>
      key in record &&
      canonicalCodexAgentRef(record[key]) === undefined &&
      !(
        typeof record[key] === "string" &&
        /^[a-z0-9][a-z0-9_]{0,63}$/.test(record[key])
      ),
  );
}

function soleReceiverAgentRef(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length !== 1) return undefined;
  return canonicalCodexAgentRef(value[0]);
}

function unsafeReceiverAgentRef(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 1) return true;
  const receiver = value[0];
  if (typeof receiver !== "string" || receiver.length > 128) return true;
  if (canonicalCodexAgentRef(receiver)) return false;
  return !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(receiver);
}

function invalidCompletedReceiverAgentRef(event: CodexEvent): boolean {
  if (event.type !== "item.completed" || !event.item) return false;
  const item = event.item;
  return ["receiver_thread_ids", "receiverThreadIds"].some(
    (key) =>
      key in item && unsafeReceiverAgentRef(item[key as keyof typeof item]),
  );
}

function collaborationAgentRefCandidates(event: CodexEvent): string[] {
  const item = event.item;
  const candidates = [item, event.tool_response, event.result];
  const references = candidates.flatMap(taskNameAgentRefs);
  const receiver = soleReceiverAgentRef(
    item?.receiver_thread_ids ?? item?.receiverThreadIds,
  );
  return receiver ? [...references, receiver] : references;
}

function acceptedCollaborationAgentRef(event: CodexEvent): string | undefined {
  const candidates = collaborationAgentRefCandidates(event);
  return new Set(candidates).size === 1 ? candidates[0] : undefined;
}

function completedGoalOwnerAgentRef(stream: string): string | undefined {
  const references = codexEvents(stream).flatMap((event) => {
    const item = event.item;
    const markedOwner =
      typeof item?.prompt === "string" &&
      item.prompt.startsWith("- phase: adaptive-delivery-owner\n");
    if (
      event.type !== "item.completed" ||
      item?.type !== "collab_tool_call" ||
      item.tool !== "spawn_agent" ||
      item.status !== "completed" ||
      !markedOwner
    )
      return [];
    const reference = acceptedCollaborationAgentRef(event);
    return reference ? [reference] : [];
  });
  return references.length === 1 ? references[0] : undefined;
}

function collaborationAgentRefConflicts(
  event: CodexEvent,
  acceptedAgentRef?: string,
): boolean {
  const candidates = collaborationAgentRefCandidates(event);
  return (
    [event.item, event.tool_response, event.result].some(
      invalidTaskNameAgentRef,
    ) ||
    invalidCompletedReceiverAgentRef(event) ||
    new Set(candidates).size > 1 ||
    (!!acceptedAgentRef &&
      candidates.some((candidate) => candidate !== acceptedAgentRef))
  );
}

function retainedCollaborationPrompt(prompt: unknown): string | undefined {
  if (typeof prompt !== "string") return undefined;
  const lines = prompt.split("\n");
  if (/^- phase: adaptive-delivery-(?:owner|runner)$/.test(lines[0] ?? ""))
    return lines[0];
  const retained = lines
    .filter((line, index) => {
      if (/^- phase: adaptive-delivery-(?:owner|runner)$/.test(line))
        return false;
      return (
        /^- (?:phase|iteration|stable_child_id|required skill|phase_skill): /.test(
          line,
        ) ||
        (index === 0 && /^- review_axis: (?:standards|spec)$/.test(line))
      );
    })
    .join("\n");
  return retained || undefined;
}

function retainedCollaborationEvent(
  event: CodexEvent,
  spawnGuardSecret?: string,
  acceptedAgentRef?: string,
): unknown | undefined {
  if (!acceptedCollaborationEvent(event)) return undefined;
  const item = event.item!;
  const prompt = retainedCollaborationPrompt(item.prompt);
  const attestation = collaborationSpawnAttestation(item, spawnGuardSecret);
  const isGoalOwner = prompt === "- phase: adaptive-delivery-owner";
  if (collaborationAgentRefConflicts(event, acceptedAgentRef)) return undefined;
  const agentRef =
    acceptedCollaborationAgentRef(event) ||
    ((attestation || isGoalOwner) && acceptedAgentRef) ||
    undefined;
  if (
    acceptedAgentRef &&
    item.tool !== "spawn_agent" &&
    agentRef !== acceptedAgentRef
  )
    return undefined;
  return retainedCollaborationRecord(event, item, {
    prompt,
    attestation,
    agentRef,
  });
}

function taskNameDiagnosticClass(value: unknown): string {
  if (value === undefined) return "absent";
  if (canonicalCodexAgentRef(value)) return "agent_ref";
  if (typeof value === "string" && /^[a-z0-9][a-z0-9_]{0,63}$/.test(value))
    return "task_label";
  return "invalid";
}

function diagnosticString(value: unknown): string {
  return typeof value === "string" ? value : "unknown";
}

function rejectedCollaborationReasons(
  event: CodexEvent,
  acceptedAgentRef?: string,
): string[] {
  const reasons: string[] = [];
  if (!acceptedCollaborationEvent(event)) reasons.push("event_shape");
  if (collaborationAgentRefConflicts(event, acceptedAgentRef))
    reasons.push("agent_reference");
  return reasons.length > 0 ? reasons : ["unknown"];
}

function retainedRejectedCollaborationDiagnostic(
  event: CodexEvent,
  collaboration: unknown,
  acceptedAgentRef?: string,
): object | undefined {
  const item = event.item;
  if (collaboration || item?.tool !== "spawn_agent") return undefined;
  const taskName = item.task_name ?? item.taskName;
  const receiver = item.receiver_thread_ids ?? item.receiverThreadIds;
  return {
    type: "darrow.collaboration_launch_rejected",
    event_type: diagnosticString(event.type),
    item_type: diagnosticString(item.type),
    status: diagnosticString(item.status),
    reasons: rejectedCollaborationReasons(event, acceptedAgentRef),
    task_name_class: taskNameDiagnosticClass(taskName),
    receiver_count: Array.isArray(receiver) ? receiver.length : -1,
    item_keys: Object.keys(item)
      .filter((key) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      .sort(),
  };
}

function retainedSpawnRouteFields(
  item: NonNullable<CodexEvent["item"]>,
): Record<string, string> {
  if (item.tool !== "spawn_agent") return {};
  const retained: Record<string, string> = {};
  const taskName = boundedRouteField(
    item.task_name ?? item.taskName,
    /^[a-z0-9][a-z0-9_]{0,63}$/,
  );
  const model = boundedRouteField(item.model, /^.{1,128}$/s);
  const reasoningEffort = boundedRouteField(
    item.reasoning_effort ?? item.reasoningEffort,
    /^(?:low|medium|high|xhigh|max|ultra)$/,
  );
  const forkTurns = boundedRouteField(
    item.fork_turns ?? item.forkTurns,
    /^(?:none|all|[1-9][0-9]*)$/,
  );
  if (taskName) retained.task_name = taskName;
  if (model) retained.model = model;
  if (reasoningEffort) retained.reasoning_effort = reasoningEffort;
  if (forkTurns) retained.fork_turns = forkTurns;
  return retained;
}

function boundedRouteField(
  value: unknown,
  pattern: RegExp,
): string | undefined {
  if (typeof value !== "string") return undefined;
  return pattern.test(value) ? value : undefined;
}

function boundedCollaborationIdentifier(value: unknown): string | undefined {
  return boundedRouteField(value, /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/);
}

function boundedCollaborationReceivers(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > 8) return undefined;
  const receivers = value.map(boundedCollaborationIdentifier);
  return receivers.every((receiver) => receiver !== undefined)
    ? (receivers as string[])
    : undefined;
}

function acceptedNativeSpawn(event: CodexEvent, agentRef?: string): boolean {
  return (
    event.type === "item.completed" &&
    event.item?.tool === "spawn_agent" &&
    event.item.status === "completed" &&
    agentRef !== undefined
  );
}

function collaborationSpawnAttestation(
  item: NonNullable<CodexEvent["item"]>,
  secret?: string,
): ReturnType<typeof verifiedCodexSpawnAttestation> {
  if (item.tool !== "spawn_agent" || !secret || typeof item.prompt !== "string")
    return undefined;
  return verifiedCodexSpawnAttestation(item.prompt, secret);
}

function retainedCollaborationRecord(
  event: CodexEvent,
  item: NonNullable<CodexEvent["item"]>,
  evidence: {
    prompt?: string;
    attestation: ReturnType<typeof verifiedCodexSpawnAttestation>;
    agentRef?: string;
  },
): object {
  const retained: Record<string, unknown> = {
    event_type: event.type,
    type: item.type,
    tool: item.tool,
    status: item.status,
  };
  const sender = boundedCollaborationIdentifier(
    item.sender_thread_id ?? item.senderThreadId,
  );
  const receivers = boundedCollaborationReceivers(
    item.receiver_thread_ids ?? item.receiverThreadIds,
  );
  if (sender) retained.sender_thread_id = sender;
  if (receivers) retained.receiver_thread_ids = receivers;
  if (evidence.agentRef) retained.agent_ref = evidence.agentRef;
  if (acceptedNativeSpawn(event, evidence.agentRef))
    retained.launch_accepted = true;
  if (evidence.prompt) retained.prompt = evidence.prompt;
  Object.assign(retained, retainedSpawnRouteFields(item));
  if (evidence.attestation)
    retained.goal_spawn_attestation = publicSpawnAttestation(
      evidence.attestation,
    );
  return { type: event.type, item: retained };
}

function publicSpawnAttestation(
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
): object {
  return {
    model: attestation.model,
    effort: attestation.effort,
    forkTurns: attestation.forkTurns,
    requestSha256: attestation.requestSha256,
    objectiveSha256: attestation.objectiveSha256,
    contractSha256: attestation.contractSha256,
    baselineSha256: attestation.baselineSha256,
    fixtureStateSha256: attestation.fixtureStateSha256,
    objectiveMode: attestation.objectiveMode,
  };
}

interface PostGoalEvidenceContext {
  seen: Set<string>;
  repoDir: string;
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>;
  adaptiveDeliveryPreflightPath?: string;
  agentRef?: string;
  activationState: "pending" | "recorded" | "rejected";
  goalPersistence: "none" | "confirmed" | "unavailable";
  waited: boolean;
  interrupted: boolean;
  closed: boolean;
  launchStopRecorded: boolean;
  objectiveReleased: boolean;
}

function retainedPostGoalToolEvent(
  event: CodexEvent,
  context: PostGoalEvidenceContext,
): unknown | undefined {
  const item = postGoalToolItem(event);
  if (!item) return undefined;
  const id = typeof item.id === "string" ? item.id : undefined;
  if (id && context.seen.has(id)) return undefined;
  if (id) context.seen.add(id);
  if (retainedHumanFeedbackEvent(event)) return undefined;
  const lifecycle = retainedGoalLifecycleEvent(event, context);
  if (lifecycle) return lifecycle;
  return {
    type: "darrow.parent_tool_after_goal",
    operation: postGoalToolOperation(item, context.repoDir),
  };
}

function retainedGoalLifecycleEvent(
  event: CodexEvent,
  context: PostGoalEvidenceContext,
): unknown | undefined {
  const activation = retainedGoalActivationEvent(
    event,
    context.attestation,
    context.adaptiveDeliveryPreflightPath,
    context.agentRef,
  );
  if (activation) return activation;
  const rejected = retainedGoalActivationRejectedEvent(
    event,
    context.attestation,
    context.adaptiveDeliveryPreflightPath,
    context.agentRef,
  );
  if (rejected) return rejected;
  const goalPersistence = retainedGoalPersistenceForState(event, context);
  if (goalPersistence) return goalPersistence;
  const launchStop =
    context.activationState === "rejected" && context.interrupted
      ? retainedGoalLaunchStopEvent(
          event,
          context.attestation,
          context.adaptiveDeliveryPreflightPath,
          context.agentRef,
        )
      : undefined;
  if (launchStop) return launchStop;
  const release = retainedObjectiveReleaseEvent(
    event,
    context.attestation,
    context.adaptiveDeliveryPreflightPath,
  );
  if (release) return release;
  const report = retainedGoalReportEvent(
    event,
    context.attestation,
    context.adaptiveDeliveryPreflightPath,
  );
  return goalReportFollowsLifecycle(report, context) ? report : undefined;
}

function retainedGoalPersistenceForState(
  event: CodexEvent,
  context: PostGoalEvidenceContext,
): unknown | undefined {
  return context.activationState === "recorded"
    ? retainedGoalPersistenceEvent(
        event,
        context.attestation,
        context.adaptiveDeliveryPreflightPath,
        context.agentRef,
      )
    : undefined;
}

function goalReportFollowsLifecycle(
  report: unknown,
  context: PostGoalEvidenceContext,
): boolean {
  if (!report || typeof report !== "object" || Array.isArray(report))
    return false;
  const status = (report as { status?: unknown }).status;
  if (status !== "launch-required")
    return (
      context.activationState === "recorded" &&
      context.goalPersistence === "confirmed"
    );
  return (
    acceptedLaunchFailureLifecycle(context) ||
    acceptedGoalPersistenceFailureLifecycle(context)
  );
}

function acceptedGoalPersistenceFailureLifecycle(
  context: PostGoalEvidenceContext,
): boolean {
  const objectiveClean =
    context.attestation?.objectiveMode !== "file-backed" ||
    context.objectiveReleased;
  return [
    context.activationState === "recorded",
    context.goalPersistence === "unavailable",
    context.waited,
    objectiveClean,
  ].every(Boolean);
}

function acceptedLaunchFailureLifecycle(
  context: PostGoalEvidenceContext,
): boolean {
  const objectiveClean =
    context.attestation?.objectiveMode !== "file-backed" ||
    context.objectiveReleased;
  return [
    context.activationState === "rejected",
    context.interrupted,
    context.closed,
    context.launchStopRecorded,
    objectiveClean,
  ].every(Boolean);
}

function postGoalToolItem(
  event: CodexEvent,
): NonNullable<CodexEvent["item"]> | undefined {
  const item = event.item;
  const valid = [
    event.type === "item.started" || event.type === "item.completed",
    !!item,
    typeof item?.type === "string",
    !postGoalToolIgnored(String(item?.type)),
    !(item?.type === "command_execution" && event.type === "item.started"),
  ].every(Boolean);
  return valid ? item : undefined;
}

function postGoalToolIgnored(type: string): boolean {
  return [
    "agent_message",
    "reasoning",
    "error",
    "collab_tool_call",
    "collabAgentToolCall",
  ].includes(type);
}

function literalShellWords(command: string): string[] | undefined {
  const payload = shellPayload(command)?.trim();
  if (!payload) return undefined;
  const words: string[] = [];
  const token =
    /(?:'([^'\r\n]*)'|"([^"$`\\\r\n]*)"|([A-Za-z0-9_./:@,+%=-]+))(?:[ \t]+|$)/y;
  let index = 0;
  while (index < payload.length) {
    token.lastIndex = index;
    const match = token.exec(payload);
    if (!match) return undefined;
    words.push(match[1] ?? match[2] ?? match[3]!);
    index = token.lastIndex;
  }
  return words;
}

function retainedObjectiveReleaseEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  adaptiveDeliveryPreflightPath?: string,
): unknown | undefined {
  const command = completedCommand(event);
  if (!command || !attestation || !adaptiveDeliveryPreflightPath)
    return undefined;
  if (
    !objectiveReleaseCommandMatches(
      command,
      attestation,
      adaptiveDeliveryPreflightPath,
    )
  )
    return undefined;
  if (!objectiveReleaseOutputMatches(event, attestation)) return undefined;
  return {
    type: "darrow.objective_release",
    status: "completed",
    contract_sha256: attestation.contractSha256,
  };
}

function retainedGoalActivationEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  adaptiveDeliveryPreflightPath?: string,
  acceptedAgentRef?: string,
): unknown | undefined {
  const command = completedCommand(event);
  if (
    !command ||
    !attestation ||
    !adaptiveDeliveryPreflightPath ||
    !acceptedAgentRef
  )
    return undefined;
  const evidence = goalActivationCommandEvidence(
    command,
    attestation,
    adaptiveDeliveryPreflightPath,
    acceptedAgentRef,
  );
  if (!evidence || !goalActivationOutputMatches(event, evidence))
    return undefined;
  return {
    type: "darrow.goal_activation",
    status: "completed",
    boundary: "native_subagent",
    agent_ref: evidence.agentRef,
    effective_route: evidence.route,
  };
}

function retainedGoalActivationRejectedEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  adaptiveDeliveryPreflightPath?: string,
  acceptedAgentRef?: string,
): unknown | undefined {
  const command = rejectedCommand(event);
  if (
    !command ||
    !attestation ||
    !adaptiveDeliveryPreflightPath ||
    !acceptedAgentRef
  )
    return undefined;
  const evidence = goalActivationCommandEvidence(
    command,
    attestation,
    adaptiveDeliveryPreflightPath,
    acceptedAgentRef,
  );
  return evidence
    ? {
        type: "darrow.goal_activation_rejected",
        status: "rejected",
        agent_ref: evidence.agentRef,
      }
    : undefined;
}

function retainedGoalPersistenceEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  adaptiveDeliveryPreflightPath?: string,
  acceptedAgentRef?: string,
): unknown | undefined {
  if (!attestation || !adaptiveDeliveryPreflightPath || !acceptedAgentRef)
    return undefined;
  const status = goalPersistenceCommandStatus(
    event,
    attestation,
    adaptiveDeliveryPreflightPath,
    acceptedAgentRef,
  );
  if (!status || !goalPersistenceOutputMatches(event, status)) return undefined;
  return {
    type: "darrow.goal_persistence",
    status: status === "active" ? "confirmed" : "unavailable",
    agent_ref: acceptedAgentRef,
  };
}

function goalPersistenceCommandStatus(
  event: CodexEvent,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
  adaptiveDeliveryPreflightPath: string,
  acceptedAgentRef: string,
): "active" | "unavailable" | undefined {
  const command = completedCommand(event);
  const sender = event.item?.sender_thread_id ?? event.item?.senderThreadId;
  if (!command || sender !== acceptedAgentRef) return undefined;
  const words = literalShellWords(command);
  const status = words?.[7];
  if (status !== "active" && status !== "unavailable") return undefined;
  const expected = [
    "/bin/bash",
    adaptiveDeliveryPreflightPath,
    "step",
    "goal-state",
    "--ledger",
    attestation.ledger,
    "--status",
    status,
  ];
  return JSON.stringify(words) === JSON.stringify(expected)
    ? status
    : undefined;
}

function goalPersistenceOutputMatches(
  event: CodexEvent,
  status: "active" | "unavailable",
): boolean {
  const output = event.item?.aggregated_output;
  return !(
    typeof output !== "string" ||
    !/^format\tdarrow-goal-step-v1$/m.test(output) ||
    !/^step\tgoal-state$/m.test(output) ||
    !/^status\trecorded$/m.test(output) ||
    !new RegExp(`^goal_state\\t${status}$`, "m").test(output)
  );
}

function rejectedCommand(event: CodexEvent): string | undefined {
  if (
    event.type !== "item.completed" ||
    event.item?.type !== "command_execution" ||
    typeof event.item.command !== "string" ||
    typeof event.item.exit_code !== "number" ||
    event.item.exit_code === 0 ||
    (event.item.status !== "completed" && event.item.status !== "failed")
  )
    return undefined;
  return event.item.command;
}

function goalActivationCommandEvidence(
  command: string,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
  adaptiveDeliveryPreflightPath: string,
  acceptedAgentRef: string,
): { agentRef: string; route: string } | undefined {
  const words = literalShellWords(command);
  const route = `codex|openai|${attestation.model}|${attestation.effort}`;
  if (!words || words.length !== 16) return undefined;
  const prefix = [
    "/bin/bash",
    adaptiveDeliveryPreflightPath,
    "step",
    "activate",
    "--ledger",
    attestation.ledger,
    "--applied-by",
    "native-subagent",
    "--boundary",
    "native_subagent",
    "--agent-ref",
  ];
  if (JSON.stringify(words.slice(0, 11)) !== JSON.stringify(prefix))
    return undefined;
  const agentRef = words[11]!;
  if (
    canonicalCodexAgentRef(agentRef) !== agentRef ||
    agentRef !== acceptedAgentRef
  )
    return undefined;
  const suffix = ["--effective-route", route, "--route-verified", "true"];
  if (JSON.stringify(words.slice(12)) !== JSON.stringify(suffix))
    return undefined;
  return { agentRef, route };
}

function goalActivationOutputMatches(
  event: CodexEvent,
  evidence: { agentRef: string; route: string },
): boolean {
  const output = event.item?.aggregated_output;
  return !(
    typeof output !== "string" ||
    !/^format\tdarrow-goal-step-v1$/m.test(output) ||
    !/^step\tactivate$/m.test(output) ||
    !/^status\trecorded$/m.test(output) ||
    !new RegExp(`^agent_ref\\t${escapeRegExp(evidence.agentRef)}$`, "m").test(
      output,
    ) ||
    !new RegExp(
      `^effective_route\\t${escapeRegExp(evidence.route)}$`,
      "m",
    ).test(output) ||
    !/^route_verified\ttrue$/m.test(output)
  );
}

function retainedGoalLaunchStopEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  adaptiveDeliveryPreflightPath?: string,
  acceptedAgentRef?: string,
): unknown | undefined {
  const command = completedCommand(event);
  if (
    !command ||
    !attestation ||
    !adaptiveDeliveryPreflightPath ||
    !acceptedAgentRef
  )
    return undefined;
  if (
    !goalLaunchStopCommandMatches(
      command,
      attestation,
      adaptiveDeliveryPreflightPath,
      acceptedAgentRef,
    ) ||
    !goalLaunchStopOutputMatches(event, acceptedAgentRef)
  )
    return undefined;
  return {
    type: "darrow.goal_launch_stop",
    status: "launch-unavailable",
    agent_ref: acceptedAgentRef,
    child_invocations: 1,
  };
}

function goalLaunchStopCommandMatches(
  command: string,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
  adaptiveDeliveryPreflightPath: string,
  acceptedAgentRef: string,
): boolean {
  const expected = [
    "/bin/bash",
    adaptiveDeliveryPreflightPath,
    "step",
    "launch-stop",
    "--ledger",
    attestation.ledger,
    "--reason",
    "launch-unavailable",
    "--agent-ref",
    acceptedAgentRef,
  ];
  return (
    JSON.stringify(literalShellWords(command)) === JSON.stringify(expected)
  );
}

function goalLaunchStopOutputMatches(
  event: CodexEvent,
  acceptedAgentRef: string,
): boolean {
  const output = event.item?.aggregated_output;
  return (
    typeof output === "string" &&
    /^format\tdarrow-goal-step-v1$/m.test(output) &&
    /^step\tlaunch-stop$/m.test(output) &&
    /^status\trecorded$/m.test(output) &&
    /^reason\tlaunch-unavailable$/m.test(output) &&
    new RegExp(`^agent_ref\\t${escapeRegExp(acceptedAgentRef)}$`, "m").test(
      output,
    )
  );
}

function retainedGoalReportEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  adaptiveDeliveryPreflightPath?: string,
): unknown | undefined {
  const command = completedCommand(event);
  if (!command || !attestation || !adaptiveDeliveryPreflightPath)
    return undefined;
  const evidence = goalReportCommandEvidence(
    command,
    attestation,
    adaptiveDeliveryPreflightPath,
  );
  if (!evidence || !goalReportOutputMatches(event, evidence.status))
    return undefined;
  return {
    type: "darrow.goal_report",
    status: evidence.status,
    human_interruptions: evidence.humanInterruptions,
  };
}

function goalReportCommandEvidence(
  command: string,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
  adaptiveDeliveryPreflightPath: string,
): { status: string; humanInterruptions: number } | undefined {
  const words = literalShellWords(command);
  if (!words || words.length !== 10) return undefined;
  const prefix = [
    "/bin/bash",
    adaptiveDeliveryPreflightPath,
    "step",
    "report",
    "--ledger",
    attestation.ledger,
    "--status",
  ];
  if (JSON.stringify(words.slice(0, 7)) !== JSON.stringify(prefix))
    return undefined;
  const status = words[7]!;
  if (!["complete", "blocked", "launch-required"].includes(status))
    return undefined;
  if (words[8] !== "--human-interruptions" || !/^\d+$/.test(words[9]!))
    return undefined;
  return { status, humanInterruptions: Number(words[9]) };
}

function goalReportOutputMatches(event: CodexEvent, status: string): boolean {
  const terminal = {
    complete: "Native goal completed.",
    blocked: "Native goal settled as blocked.",
    "launch-required": "Native goal requires host launch.",
  }[status];
  const output = event.item?.aggregated_output;
  return !(
    typeof output !== "string" ||
    !/^format: darrow-native-goal-report-v1$/m.test(output) ||
    !new RegExp(`^${escapeRegExp(terminal!)}$`, "m").test(output)
  );
}

function objectiveReleaseCommandMatches(
  command: string,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
  adaptiveDeliveryPreflightPath: string,
): boolean {
  if (!attestation.attachmentDir || attestation.objectiveMode !== "file-backed")
    return false;
  const expected = [
    "/bin/bash",
    adaptiveDeliveryPreflightPath,
    "step",
    "release-objective",
    "--ledger",
    attestation.ledger,
    "--attachment-dir",
    attestation.attachmentDir,
    "--expected-sha256",
    attestation.contractSha256,
  ];
  return (
    JSON.stringify(literalShellWords(command)) === JSON.stringify(expected)
  );
}

function objectiveReleaseOutputMatches(
  event: CodexEvent,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
): boolean {
  if (!attestation.attachmentDir) return false;
  const output = event.item?.aggregated_output;
  return !(
    typeof output !== "string" ||
    !/^format\tdarrow-native-goal-objective-release-v1$/m.test(output) ||
    !/^status\treleased$/m.test(output) ||
    !new RegExp(
      `^attachment_dir\\t${escapeRegExp(attestation.attachmentDir)}$`,
      "m",
    ).test(output)
  );
}

function postGoalToolOperation(
  item: NonNullable<CodexEvent["item"]>,
  repoDir: string,
): string {
  return item.type === "command_execution" && typeof item.command === "string"
    ? postGoalCommandOperation(item.command, repoDir)
    : String(item.type);
}

function postGoalCommandOperation(command: string, repoDir: string): string {
  if (/\bgit\s+(?:status|diff)\b/.test(command)) return "repository-inspection";
  if (executedVerification(command)) return "verification";
  if (/\bindependent-review-fixture\b/.test(command))
    return "independent-review";
  if (
    /\badaptive-delivery-preflight\s+release-(?:staging|objective)\b/.test(
      command,
    )
  )
    return "objective-cleanup";
  const privateRoot = join(repoDir, ".git", "darrow-eval", "state", "codex");
  if (/\brm\b/.test(command) && command.includes(privateRoot))
    return "private-staging-cleanup";
  return "command";
}

/** Bounded executable positions; mentions in read commands/quoted prose do not run tests. */
function executedVerification(command: string): boolean {
  const payload = shellPayload(command) ?? command;
  const clauses = payload.match(/(?:[^'";&|\n]|'[^']*'|"[^"]*")+/g) ?? [];
  return clauses.some((clause) => {
    const executable = shellClauseExecutable(clause);
    if (executable === "test.sh") return true;
    if (["bash", "sh"].includes(executable ?? ""))
      return /^\s*(?:\/[^\s]+\/)?(?:bash|sh)\s+(?:\.\/)?test\.sh(?:\s|$)/.test(
        clause,
      );
    if (["bun", "npm", "pnpm"].includes(executable ?? ""))
      return /\b(?:bun|npm|pnpm)\s+(?:run\s+)?test\b/.test(clause);
    return executable === "node" && /\bnode\s+--test\b/.test(clause);
  });
}

function retainedPreGoalToolEvent(
  event: CodexEvent,
  repoDir: string,
): unknown | undefined {
  const item = event.item;
  if (!item || typeof item.type !== "string") return undefined;
  const command = finishedCommandForSkillRead(event);
  if (command) {
    const operation = postGoalCommandOperation(command, repoDir);
    return operation === "verification" || operation === "independent-review"
      ? { type: "darrow.parent_tool_before_goal", operation }
      : undefined;
  }
  if (
    event.type === "item.started" &&
    ![
      "agent_message",
      "reasoning",
      "command_execution",
      // The spawn hook allows apply_patch before ownership only for the one
      // objective staging file inside the evaluator-created temporary root.
      "file_change",
      "collab_tool_call",
      "collabAgentToolCall",
      "file_read",
      "grep",
      "glob",
    ].includes(item.type)
  )
    return {
      type: "darrow.parent_tool_before_goal",
      operation: item.type,
    };
  return undefined;
}

function acceptedGoalOwnerSpawn(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as {
    type?: unknown;
    item?: {
      tool?: unknown;
      status?: unknown;
      agent_ref?: unknown;
      prompt?: unknown;
      goal_spawn_attestation?: unknown;
    };
  };
  return (
    event.type === "item.completed" &&
    event.item?.tool === "spawn_agent" &&
    event.item.status === "completed" &&
    canonicalCodexAgentRef(event.item.agent_ref) === event.item.agent_ref &&
    (!!event.item.goal_spawn_attestation ||
      event.item.prompt === "- phase: adaptive-delivery-owner")
  );
}

function retainedHumanFeedbackEvent(event: CodexEvent): unknown | undefined {
  const command = completedCommand(event);
  const payload = command ? shellPayload(command)?.trim() : undefined;
  if (!payload || !/(?:^|\/)feedbackctl answer rounding-mode$/.test(payload))
    return undefined;
  return {
    type: "darrow.human_feedback_answer",
    feedback_id: "rounding-mode",
    status: "completed",
  };
}

function retainedHostProtocolEvent(event: CodexEvent): unknown | undefined {
  if (
    event.type !== "darrow.route_applied" &&
    event.type !== "darrow.dimensions_applied" &&
    event.type !== "darrow.workflow_loaded"
  )
    return undefined;
  const allowed = [
    "type",
    "accepted",
    "threadId",
    "turnId",
    "selected",
    "effective",
    "appliedBy",
    "stage",
    "workflow",
    "risk",
    "file",
    "sha256",
  ];
  return Object.fromEntries(
    allowed.flatMap((key) =>
      event[key] === undefined ? [] : [[key, event[key]]],
    ),
  );
}

function retainedNestedApplication(event: CodexEvent): unknown | undefined {
  const item = event.item;
  if (
    event.type !== "item.completed" ||
    item?.type !== "command_execution" ||
    item.status !== "completed" ||
    item.exit_code !== 0 ||
    typeof item.aggregated_output !== "string" ||
    !/^format\tdarrow-native-goal-route-application-v1$/m.test(
      item.aggregated_output,
    ) ||
    !/^route_applied_by\tnested-session$/m.test(item.aggregated_output) ||
    !/^route_verified\ttrue$/m.test(item.aggregated_output)
  )
    return undefined;
  const protocol = item.aggregated_output
    .split("\n")
    .filter((line) =>
      /^(?:format|route_applied_by|route_verified|selected_route|effective_route)\t/.test(
        line,
      ),
    );
  const completed = codexEvents(item.aggregated_output)
    .filter((nested) => codexEventTypes(nested).includes("turn.completed"))
    .map(retainedTerminalEvent)
    .filter((nested): nested is object => nested !== undefined);
  return {
    type: "item.completed",
    item: {
      type: "command_execution",
      status: "completed",
      exit_code: 0,
      aggregated_output: [
        ...completed.map((value) => JSON.stringify(value)),
        ...protocol,
      ].join("\n"),
    },
  };
}

interface CodexRetentionStatus {
  exitCode: number;
  stderrPresent: boolean;
  explicitlyInvokedSkill?: string;
  nativeSession?: string;
  expectedFollowUpPrompt?: string;
  spawnGuardSecret?: string;
  adaptiveDeliveryPreflightPath?: string;
  acceptedAgentRef?: string;
  acceptedOwner?: AcceptedCodexOwner;
}

interface CodexRetentionState {
  goalOwnerAccepted: boolean;
  goalAttestation: ReturnType<typeof verifiedCodexSpawnAttestation>;
  postGoalToolIds: Set<string>;
  pendingPostGoalCommands: Set<string>;
  goalOwnerReference?: string;
  activationState: "pending" | "recorded" | "rejected";
  goalPersistence: "none" | "confirmed" | "unavailable";
  waited: boolean;
  interrupted: boolean;
  closed: boolean;
  launchStopRecorded: boolean;
  objectiveReleased: boolean;
}

function retainedLifecycleEvent(
  event: CodexEvent,
  state: CodexRetentionState,
  repoDir: string,
  status?: CodexRetentionStatus,
): unknown | undefined {
  if (!state.goalOwnerAccepted) return retainedPreGoalToolEvent(event, repoDir);
  return retainedPostGoalToolEvent(event, {
    seen: state.postGoalToolIds,
    repoDir,
    attestation: state.goalAttestation,
    adaptiveDeliveryPreflightPath: status?.adaptiveDeliveryPreflightPath,
    agentRef: state.goalOwnerReference,
    activationState: state.activationState,
    goalPersistence: state.goalPersistence,
    waited: state.waited,
    interrupted: state.interrupted,
    closed: state.closed,
    launchStopRecorded: state.launchStopRecorded,
    objectiveReleased: state.objectiveReleased,
  });
}

function retainCodexEvent(
  event: CodexEvent,
  state: CodexRetentionState,
  repoDir: string,
  status?: CodexRetentionStatus,
): object[] {
  if (event.type === "darrow.eval.follow_up_turn") return [event];
  const collaboration = retainedCollaborationEvent(
    event,
    status?.spawnGuardSecret,
    state.goalOwnerReference ?? status?.acceptedAgentRef,
  );
  const lifecycle = retainedLifecycleEvent(event, state, repoDir, status);
  const collaborationViolation = retainedCollaborationViolation(
    event,
    collaboration,
    state,
  );
  const postOwnerSpawn = retainedPostOwnerSpawnObservation(event, state);
  const collaborationDiagnostic = retainedRejectedCollaborationDiagnostic(
    event,
    collaboration,
    state.goalOwnerReference ?? status?.acceptedAgentRef,
  );
  const values = [
    retainedTerminalEvent(event),
    retainedHostProtocolEvent(event),
    collaboration,
    retainedHumanFeedbackEvent(event),
    retainedNestedApplication(event),
    lifecycle,
    collaborationViolation,
    postOwnerSpawn,
    collaborationDiagnostic,
  ].filter((value): value is object => value !== undefined);
  trackPostGoalCommand(event, state);
  acceptAttestedGoalSpawn(event, collaboration, state, status);
  updateGoalLifecycleState(event, collaboration, lifecycle, state);
  return values;
}

function runnerControlKind(event: CodexEvent): string | undefined {
  if (!acceptedCollaborationEvent(event)) return undefined;
  const tool = event.item?.tool;
  return typeof tool === "string" &&
    [
      "wait",
      "wait_agent",
      "followup_task",
      "send_message",
      "interrupt_agent",
      "close_agent",
    ].includes(tool)
    ? tool
    : undefined;
}

function retainedCollaborationViolation(
  event: CodexEvent,
  collaboration: unknown,
  state: CodexRetentionState,
): object | undefined {
  const tool = state.goalOwnerAccepted ? runnerControlKind(event) : undefined;
  if (!tool) return undefined;
  const activationRequired = ["wait", "wait_agent", "send_message"].includes(
    tool,
  );
  const invalidOrder = activationRequired
    ? state.activationState !== "recorded"
    : state.activationState === "pending";
  return !collaboration || invalidOrder
    ? { type: "darrow.parent_tool_after_goal", operation: tool }
    : undefined;
}

function retainedPostOwnerSpawnObservation(
  event: CodexEvent,
  state: CodexRetentionState,
): object | undefined {
  if (
    !state.goalOwnerAccepted ||
    !acceptedCollaborationEvent(event) ||
    event.item?.tool !== "spawn_agent"
  )
    return undefined;
  const senderRef = canonicalCodexAgentRef(event.item.sender_thread_id);
  if (senderRef === state.goalOwnerReference) return undefined;
  const agentRef = acceptedCollaborationAgentRef(event);
  return {
    type: "darrow.parent_spawn_after_goal",
    tool: "spawn_agent",
    status: event.item.status,
    ...(senderRef ? { sender_thread_id: senderRef } : {}),
    ...(agentRef ? { agent_ref: agentRef } : {}),
  };
}

function retainedEventType(value: unknown): string | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? String((value as { type?: unknown }).type ?? "") || undefined
    : undefined;
}

function updateGoalLifecycleState(
  event: CodexEvent,
  collaboration: unknown,
  lifecycle: unknown,
  state: CodexRetentionState,
): void {
  updateLedgerLifecycleState(lifecycle, state);
  if (collaboration) updateCollaborationLifecycleState(event, state);
}

function updateLedgerLifecycleState(
  lifecycle: unknown,
  state: CodexRetentionState,
): void {
  const type = retainedEventType(lifecycle);
  if (type === "darrow.goal_activation") state.activationState = "recorded";
  if (type === "darrow.goal_activation_rejected")
    state.activationState = "rejected";
  if (type === "darrow.goal_launch_stop") state.launchStopRecorded = true;
  if (type === "darrow.goal_persistence") {
    const status = (lifecycle as { status?: unknown }).status;
    if (status === "confirmed" || status === "unavailable")
      state.goalPersistence = status;
  }
  if (type === "darrow.objective_release") state.objectiveReleased = true;
}

function updateCollaborationLifecycleState(
  event: CodexEvent,
  state: CodexRetentionState,
): void {
  const tool = runnerControlKind(event);
  if (tool === "wait" || tool === "wait_agent") state.waited = true;
  if (tool === "interrupt_agent") state.interrupted = true;
  if (tool === "close_agent") state.closed = true;
}

function trackPostGoalCommand(
  event: CodexEvent,
  state: CodexRetentionState,
): void {
  const id = event.item?.id;
  if (!state.goalOwnerAccepted || typeof id !== "string") return;
  if (event.type === "item.started" && event.item?.type === "command_execution")
    state.pendingPostGoalCommands.add(id);
  if (event.type === "item.completed") state.pendingPostGoalCommands.delete(id);
}

function acceptAttestedGoalSpawn(
  event: CodexEvent,
  collaboration: unknown,
  state: CodexRetentionState,
  status?: CodexRetentionStatus,
): void {
  if (!acceptedGoalOwnerSpawn(collaboration)) return;
  const record = collaboration as { item?: { agent_ref?: unknown } };
  const acceptedReference = canonicalCodexAgentRef(record.item?.agent_ref);
  if (!acceptedReference) return;
  state.goalOwnerAccepted = true;
  state.goalOwnerReference = acceptedReference;
  // The accepted host spawn is the route-application boundary. There is no
  // separate lifecycle activation step in the simplified protocol.
  state.activationState = "recorded";
  if (!status?.spawnGuardSecret || typeof event.item?.prompt !== "string")
    return;
  state.goalAttestation = verifiedCodexSpawnAttestation(
    event.item.prompt,
    status.spawnGuardSecret,
  );
}

function appendCodexRetentionState(
  retained: object[],
  state: CodexRetentionState,
  options: {
    acceptedOwner?: AcceptedCodexOwner;
  },
): void {
  for (let index = 0; index < state.pendingPostGoalCommands.size; index++)
    retained.push({
      type: "darrow.parent_tool_after_goal",
      operation: "incomplete-command",
    });
  if (options.acceptedOwner) {
    const owner = options.acceptedOwner;
    const route = {
      harness: "codex",
      provider: "openai",
      model: owner.model,
      effort: owner.effort,
    };
    retained.push({
      type: "darrow.goal_owner_accepted",
      agent_ref: owner.agentRef,
      workflow: owner.workflow,
      risk: owner.risk,
      profile: owner.profile,
      selected: route,
      effective: route,
      applied_by: "native-subagent",
      launch_boundary: "native_subagent",
      child_invocations: 1,
    });
  }
}

/** Retain only bounded activation, orchestration, and terminal accounting evidence. */
function codexEvidenceSkillRoots(
  repoDir: string,
  installedSkillsRoot: string | string[],
) {
  return codexTrackedSkillRoots(repoDir, installedSkillsRoot);
}

function retainedCodexSkillReads(
  event: CodexEvent,
  skillsRoots: string[],
  mountedSkills: MountedSkillBody[],
  state: {
    retainedSkills: Set<string>;
    readEvidence: Map<string, SkillReadEvidence>;
  },
): Record<string, unknown>[] {
  const { retainedSkills, readEvidence } = state;
  return observedSkillReads([event], skillsRoots, mountedSkills, {
    initialSkills: [...retainedSkills],
    readEvidence,
  }).flatMap((skill) => {
    if (retainedSkills.has(skill)) return [];
    retainedSkills.add(skill);
    return [
      {
        type: "darrow.skill_read_probe",
        source: "skill_file_read_probe",
        skill,
        status: "completed",
      },
    ];
  });
}

interface CodexNativeSessionEntry {
  ordinal: number;
  payload: Record<string, unknown>;
}

interface CodexNativeSpawnRequest {
  ordinal: number;
  callId: string;
  taskName: string;
  model: string;
  reasoningEffort: string;
  forkTurns: string;
  reviewAxis: "standards" | "spec";
}

interface CodexNativeSpawnFields {
  ordinal: number;
  callId?: string;
  argumentsValid: boolean;
  taskName?: string;
  model?: string;
  reasoningEffort?: string;
  forkTurns?: string;
  reviewAxis?: ReviewAxis;
}

function parsedRecord(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function codexNativeSessionEntries(session: string): {
  entries: CodexNativeSessionEntry[];
  malformed: boolean;
} {
  const entries: CodexNativeSessionEntry[] = [];
  let malformed = false;
  for (const line of session.split("\n").filter(Boolean)) {
    const record = parsedRecord(line);
    if (
      !record ||
      !Number.isInteger(record.ordinal) ||
      !isRecord(record.payload)
    ) {
      malformed = true;
      continue;
    }
    entries.push({
      ordinal: record.ordinal as number,
      payload: record.payload,
    });
  }
  return { entries, malformed };
}

function nativeCommandText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!Array.isArray(value) || !value.every((part) => typeof part === "string"))
    return undefined;
  if (value.length >= 3 && (value[1] === "-lc" || value[1] === "-c"))
    return value.slice(2).join(" ");
  return value.join(" ");
}

function nativeSkillReadEvents(session: string): CodexEvent[] {
  return codexNativeSessionEntries(session).entries.flatMap((entry) => {
    const { payload } = entry;
    const item = isRecord(payload.item) ? payload.item : undefined;
    if (payload.type !== "item_completed" || item?.type !== "CommandExecution")
      return [];
    const command = nativeCommandText(item.command);
    if (!command) return [];
    return [
      {
        type: "item.completed",
        item: {
          type: "command_execution",
          command,
          aggregated_output: item.aggregated_output,
          exit_code: item.exit_code,
          status: item.status,
        },
      },
    ];
  });
}

function acceptedNativeChildThreadIds(session: string): string[] {
  const { entries, malformed } = codexNativeSessionEntries(session);
  if (malformed) return [];
  return [
    ...new Set(
      entries
        .filter((entry) => isNativeSpawnCall(entry.payload))
        .flatMap((entry) => {
          const fields = nativeSpawnFields(entry);
          if (!fields.callId) return [];
          const request = { callId: fields.callId, ordinal: fields.ordinal };
          const start = nativeSpawnStart(entries, request);
          if (!start) return [];
          const accepted = nativeSpawnAcceptance(
            entries,
            request,
            start.agentRef,
          );
          return accepted !== undefined &&
            isAcceptedNativeSpawn(request, start, accepted, true)
            ? [start.threadId]
            : [];
        }),
    ),
  ];
}

interface CodexNativeSkillEvidence {
  parentSession?: string;
  observedSkills: string[];
  additionalSkills: string[];
  attemptedSkills: string[];
  malformed: boolean;
  orderConsistent: boolean;
  preOwnerSkills: string[];
  readDiagnostics: Record<string, unknown>[];
}

/** Diagnostic facts only; never substitute these records for observed reads. */
export function nativeParentReadDiagnostics(
  session: string,
  repoDir: string,
  installedSkillsRoot: string | string[],
): Record<string, unknown>[] {
  const { entries, malformed } = codexNativeSessionEntries(session);
  if (malformed) return [];
  const spawn = entries.find((entry) => isNativeSpawnCall(entry.payload));
  if (spawn && !retainedSingleNativeAgent(entries, false).length) return [];
  const roots = codexTrackedSkillRoots(repoDir, installedSkillsRoot);
  const mounted = mountedSkillBodies(repoDir, installedSkillsRoot);
  const diagnostics = entries
    .filter((entry) => !spawn || entry.ordinal < spawn.ordinal)
    .flatMap((entry) =>
      nativeReadDiagnosticsAtEntry(entry, repoDir, roots, mounted),
    );
  return diagnostics.slice(-24).map((record) => ({
    ...record,
    diagnostics_truncated: diagnostics.length > 24,
  }));
}

function nativeReadDiagnosticsAtEntry(
  entry: CodexNativeSessionEntry,
  repoDir: string,
  roots: string[],
  mounted: MountedSkillBody[],
): Record<string, unknown>[] {
  const event = nativeSkillReadEvents(JSON.stringify(entry))[0];
  if (!event) return [];
  const output =
    typeof event.item?.aggregated_output === "string"
      ? event.item.aggregated_output
      : "";
  const recognized = eventSkillReads(event, roots, mounted);
  const item = entry.payload.item as Record<string, unknown>;
  return mounted
    .filter(
      (skill, index) =>
        mounted.findIndex((other) => other.name === skill.name) === index,
    )
    .filter(
      (skill) =>
        recognized.includes(skill.name) || output.includes(skill.frontmatter),
    )
    .map((skill) => ({
      type: "darrow.codex_native_read_diagnostic",
      actor: "parent",
      ordinal: entry.ordinal,
      read_candidate: skill.name,
      recognized_read: recognized.includes(skill.name),
      complete_body_in_output: output.includes(skill.body),
      frontmatter_in_output: output.includes(skill.frontmatter),
      finished_command: finishedCommandForSkillRead(event) !== undefined,
      native_read_path_binds: nativeReadPathBinds(
        item,
        repoDir,
        roots,
        skill.name,
      ),
      ...nativeReadShape(event, item, roots, { repoDir, skill: skill.name }),
    }));
}

function nativeReadShape(
  event: CodexEvent,
  item: Record<string, unknown>,
  roots: string[],
  context: { repoDir: string; skill: string },
): Record<string, unknown> {
  const command =
    typeof event.item?.command === "string" ? event.item.command : "";
  const payload = shellPayload(command) ?? "";
  const heads = payload
    .split(/&&|\|\||[;|\n]/)
    .filter((part) => part.trim())
    .map((part) => {
      const head = shellClauseExecutable(part);
      return head && READ_DIAGNOSTIC_HEADS.has(head) ? head : "other";
    });
  const cwd = nativeReadWorkingDirectory(item.cwd);
  return {
    clause_heads: heads.slice(0, 16),
    clause_heads_truncated: heads.length > 16,
    mounted_root_mentioned: roots.some((root) =>
      commandReferencesPath(payload, root),
    ),
    skill_filename_mentioned:
      /(?:^|[^A-Za-z0-9._-])SKILL\.md(?=$|[^A-Za-z0-9._-])/.test(payload),
    cwd_is_skill_directory:
      cwd !== undefined &&
      roots.some(
        (root) => cwd === resolve(context.repoDir, root, context.skill),
      ),
  };
}

async function nativeParentSkillEvidence(
  session: string,
  repoDir: string,
  roots: string | string[],
  options: {
    configRoot: string;
    children?: Array<{ threadId: string; session: string | undefined }>;
    orderDiagnostic?: Record<string, unknown>;
  },
): Promise<
  Pick<CodexNativeSkillEvidence, "preOwnerSkills" | "readDiagnostics">
> {
  return {
    preOwnerSkills: nativePreOwnerSkillReads(session, repoDir, roots),
    readDiagnostics: [
      ...nativeParentReadDiagnostics(session, repoDir, roots),
      ...nativeChildReadDiagnostics(options.children ?? [], repoDir, roots),
      ...(await nativeNestedSpawnDiagnostics(
        options.children ?? [],
        options.configRoot,
      )),
      ...(options.orderDiagnostic ? [options.orderDiagnostic] : []),
    ],
  };
}

function nativeChildReadDiagnostics(
  children: Array<{ threadId: string; session: string | undefined }>,
  repoDir: string,
  installedSkillsRoot: string | string[],
): Record<string, unknown>[] {
  const roots = codexTrackedSkillRoots(repoDir, installedSkillsRoot);
  const mounted = mountedSkillBodies(repoDir, installedSkillsRoot);
  return children.slice(0, 8).flatMap(({ threadId, session }) => {
    const parsed =
      session === undefined ? undefined : codexNativeSessionEntries(session);
    const available = parsed !== undefined && !parsed.malformed;
    const diagnostics = available
      ? parsed.entries.flatMap((entry) =>
          nativeReadDiagnosticsAtEntry(entry, repoDir, roots, mounted),
        )
      : [];
    const identity = { actor: "accepted_child", child_thread_id: threadId };
    return [
      {
        type: "darrow.codex_native_child_skill_evidence",
        ...identity,
        session_status: !parsed
          ? "unavailable"
          : parsed.malformed
            ? "malformed"
            : "available",
        command_execution_count: available
          ? nativeSkillReadEvents(session!).length
          : null,
        read_diagnostic_count: available ? diagnostics.length : null,
        children_truncated: children.length > 8,
        diagnostics_truncated: diagnostics.length > 24,
      },
      ...diagnostics.slice(-24).map((record) => ({
        ...record,
        ...identity,
        diagnostics_truncated: diagnostics.length > 24,
      })),
    ];
  });
}

function nativeReadPathBinds(
  item: Record<string, unknown>,
  repoDir: string,
  roots: string[],
  skill: string,
): boolean {
  const cwd = nativeReadWorkingDirectory(item.cwd);
  const parsed = Array.isArray(item.parsed_cmd)
    ? item.parsed_cmd.filter(isRecord)
    : [];
  return (
    cwd !== undefined &&
    parsed.some(
      (part) =>
        part.type === "read" &&
        typeof part.path === "string" &&
        roots.some(
          (root) =>
            resolve(cwd, part.path as string) ===
            resolve(repoDir, root, skill, "SKILL.md"),
        ),
    )
  );
}

async function nativeNestedSpawnDiagnostics(
  children: Array<{ threadId: string; session: string | undefined }>,
  configRoot: string,
): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  for (const child of children.slice(0, 8)) {
    if (child.session === undefined) continue;
    const parsed = codexNativeSessionEntries(child.session);
    if (parsed.malformed) continue;
    const requests = parsed.entries.filter((entry) =>
      isNativeSpawnCall(entry.payload),
    );
    for (const entry of requests.slice(0, 8)) {
      records.push({
        ...(await nativeNestedSpawnRecord(entry, parsed.entries, configRoot)),
        parent_child_thread_id: child.threadId,
        children_truncated: children.length > 8,
        requests_truncated: requests.length > 8,
      });
    }
  }
  return records;
}

function acceptedNestedSpawnStart(
  entries: CodexNativeSessionEntry[],
  fields: CodexNativeSpawnFields,
) {
  if (!fields.callId) return undefined;
  const request = { callId: fields.callId, ordinal: fields.ordinal };
  const start = nativeSpawnStart(entries, request);
  if (!start) return undefined;
  const acceptedOrdinal = nativeSpawnAcceptance(
    entries,
    request,
    start.agentRef,
  );
  return isAcceptedNativeSpawn(request, start, acceptedOrdinal, true)
    ? start
    : undefined;
}

async function nativeNestedSpawnRecord(
  entry: CodexNativeSessionEntry,
  entries: CodexNativeSessionEntry[],
  configRoot: string,
): Promise<Record<string, unknown>> {
  const fields = nativeSpawnFields(entry);
  const start = acceptedNestedSpawnStart(entries, fields);
  const session = start
    ? await codexNativeSessionForThread(configRoot, start.threadId)
    : undefined;
  const reader =
    session === undefined ? undefined : codexNativeSessionEntries(session);
  return {
    type: "darrow.codex_native_nested_spawn",
    status: start ? "accepted" : "unaccepted",
    ...Object.fromEntries(
      Object.entries({
        task_name: fields.taskName,
        review_axis: fields.reviewAxis,
        model: fields.model,
        reasoning_effort: fields.reasoningEffort,
        fork_turns: fields.forkTurns,
      }).filter(([, value]) => value !== undefined),
    ),
    ...(start ? { child_thread_id: start.threadId } : {}),
    session_status: !reader
      ? "unavailable"
      : reader.malformed
        ? "malformed"
        : "available",
    reader_result_status:
      reader && !reader.malformed && nativeReaderResultCompleted(reader.entries)
        ? "completed"
        : "unavailable",
  };
}

/** Observe one returned native reader turn without retaining its private text. */
function nativeReaderResultCompleted(
  entries: CodexNativeSessionEntry[],
): boolean {
  const finals = entries.filter(
    ({ payload }) =>
      payload.type === "item_completed" &&
      isRecord(payload.item) &&
      payload.item.type === "AgentMessage" &&
      payload.item.phase === "final_answer",
  );
  const completions = entries.filter(
    ({ payload }) => payload.type === "task_complete",
  );
  if (
    finals.length !== 1 ||
    completions.length !== 1 ||
    entries.some(
      ({ payload }) =>
        payload.type === "turn_aborted" || payload.type === "turn_failed",
    )
  )
    return false;
  const final = finals[0]!;
  const complete = completions[0]!;
  const turn = boundedCollaborationIdentifier(final.payload.turn_id);
  const item = final.payload.item as Record<string, unknown>;
  const text = nativeFinalMessageText(item.content);
  if (
    !turn ||
    complete.payload.turn_id !== turn ||
    final.ordinal >= complete.ordinal ||
    text === undefined
  )
    return false;
  return complete.payload.last_agent_message === text;
}

function nativeFinalMessageText(content: unknown): string | undefined {
  if (
    !Array.isArray(content) ||
    !content.length ||
    !content.every(
      (part) =>
        isRecord(part) && part.type === "Text" && typeof part.text === "string",
    )
  )
    return undefined;
  const text = content.map((part) => (part as { text: string }).text).join("");
  return text.trim().length ? text : undefined;
}

function nativeReadWorkingDirectory(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (isAbsolute(value)) return value;
  try {
    const url = new URL(value);
    if (
      url.protocol === "file:" &&
      (!url.hostname || url.hostname === "localhost")
    )
      return decodeURIComponent(url.pathname);
  } catch {
    // Unavailable or malformed native path metadata proves no binding.
  }
  return undefined;
}

export function nativePreOwnerSkillReads(
  session: string,
  repoDir: string,
  installedSkillsRoot: string | string[],
): string[] {
  const { entries, malformed } = codexNativeSessionEntries(session);
  if (!retainedSingleNativeAgent(entries, malformed).length) return [];
  const spawn = entries.find((entry) => isNativeSpawnCall(entry.payload));
  if (!spawn) return [];
  const beforeSpawn = entries
    .filter((entry) => entry.ordinal < spawn.ordinal)
    .map((entry) => JSON.stringify(entry))
    .join("\n");
  return observedSkillReads(
    nativeSkillReadEvents(beforeSpawn),
    codexTrackedSkillRoots(repoDir, installedSkillsRoot),
    mountedSkillBodies(repoDir, installedSkillsRoot),
  );
}

function anchoredStreamReadOrder(
  stream: string,
  roots: string[],
  mounted: MountedSkillBody[],
): string[] {
  const attempts = codexEvents(stream).flatMap((event) => {
    const output = event.item?.aggregated_output;
    if (typeof output !== "string") return [];
    return [...new Set(eventSkillReads(event, roots, mounted))]
      .flatMap((name) => {
        const frontmatter = mounted.find(
          (skill) => skill.name === name,
        )?.frontmatter;
        const offset = frontmatter ? output.indexOf(frontmatter) : -1;
        return offset >= 0 ? [{ name, offset }] : [];
      })
      .sort((left, right) => left.offset - right.offset)
      .map(({ name }) => name);
  });
  return [...new Set(attempts)];
}

function recoveredEarlierSkillReads(
  stream: string[],
  native: string[],
  firstAttempts: string[],
): string[] {
  return native.filter((skill, index) => {
    const position = stream.indexOf(skill);
    const firstAttempt = firstAttempts.indexOf(skill);
    if (position < 0 || firstAttempt < 0) return false;
    const crossed = native
      .slice(index + 1)
      .filter(
        (other) => stream.includes(other) && stream.indexOf(other) < position,
      );
    return (
      crossed.length > 0 &&
      crossed.every((other) => firstAttempts.indexOf(other) > firstAttempt)
    );
  });
}

function mergeSkillReadOrders(
  stream: string[],
  native: string[],
  firstAttempts: string[],
) {
  const recoveredEarlier = recoveredEarlierSkillReads(
    stream,
    native,
    firstAttempts,
  );
  const observedSkills = stream.filter(
    (skill) => !recoveredEarlier.includes(skill),
  );
  for (const [index, skill] of native.entries()) {
    if (observedSkills.includes(skill)) continue;
    const next = native
      .slice(index + 1)
      .find((name) => observedSkills.includes(name));
    if (next) observedSkills.splice(observedSkills.indexOf(next), 0, skill);
    else observedSkills.push(skill);
  }
  const positions = native.map((skill) => observedSkills.indexOf(skill));
  const orderConsistent = positions.every(
    (position, index) => index === 0 || position > positions[index - 1]!,
  );
  return {
    observedSkills,
    orderConsistent,
    orderDiagnostic: {
      type: "darrow.codex_native_skill_order",
      stream_skills: stream.slice(0, 32),
      native_skills: native.slice(0, 32),
      anchored_stream_reads: firstAttempts.slice(0, 32),
      recovered_earlier_skills: recoveredEarlier.slice(0, 32),
      order_consistent: orderConsistent,
      diagnostics_truncated: [stream, native, firstAttempts].some(
        (order) => order.length > 32,
      ),
    },
  };
}

function emptyNativeSkillEvidence(
  initialSkills: string[],
): CodexNativeSkillEvidence {
  return {
    observedSkills: initialSkills,
    additionalSkills: [],
    attemptedSkills: [],
    malformed: false,
    orderConsistent: true,
    preOwnerSkills: [],
    readDiagnostics: [],
  };
}

interface CodexNativeSkillEvidenceOptions {
  stream: string;
  repoDir: string;
  configRoot: string;
  installedSkillsRoot: string | string[];
  initialSkills: string[];
  explicitPrimary?: string;
}

async function nativeChildSessions(parentSession: string, configRoot: string) {
  return Promise.all(
    acceptedNativeChildThreadIds(parentSession).map(async (threadId) => ({
      threadId,
      session: await codexNativeSessionForThread(configRoot, threadId),
    })),
  );
}

async function codexNativeSkillEvidence(
  options: CodexNativeSkillEvidenceOptions,
): Promise<CodexNativeSkillEvidence> {
  const { stream, repoDir, configRoot, installedSkillsRoot, initialSkills } =
    options;
  const threadId = codexThreadId(stream);
  const parentSession = threadId
    ? await codexNativeSessionForThread(configRoot, threadId)
    : undefined;
  if (!parentSession) return emptyNativeSkillEvidence(initialSkills);
  const children = await nativeChildSessions(parentSession, configRoot);
  const mountedSkills = mountedSkillBodies(repoDir, installedSkillsRoot);
  const roots = codexTrackedSkillRoots(repoDir, installedSkillsRoot);
  const { attemptedSkills, malformed, nativeSkills, childrenOrdered } =
    nativeSessionSkillReads(
      [parentSession, ...children.map((child) => child.session)],
      roots,
      mountedSkills,
      initialSkills,
    );
  const { observedSkills, orderConsistent, orderDiagnostic } =
    mergeSkillReadOrders(
      initialSkills,
      nativeReadOrderAfterDispatch(nativeSkills, options.explicitPrimary),
      anchoredStreamReadOrder(stream, roots, mountedSkills),
    );
  const initial = new Set(initialSkills);
  return {
    parentSession,
    observedSkills,
    additionalSkills: observedSkills.filter((skill) => !initial.has(skill)),
    attemptedSkills: [...attemptedSkills],
    malformed,
    orderConsistent: orderConsistent && childrenOrdered,
    ...(await nativeParentSkillEvidence(
      parentSession,
      repoDir,
      installedSkillsRoot,
      {
        children,
        orderDiagnostic,
        configRoot,
      },
    )),
  };
}

function nativeReadOrderAfterDispatch(
  skills: string[],
  primary?: string,
): string[] {
  // The verified explicit dispatch precedes all tool reads. Rereading that
  // owner's file is not a second selection; supporting order remains intact.
  return primary
    ? [primary, ...skills.filter((skill) => skill !== primary)]
    : skills;
}

function nativeSessionSkillReads(
  sessions: Array<string | undefined>,
  roots: string[],
  mountedSkills: MountedSkillBody[],
  initialSkills: string[],
) {
  const attemptedSkills = new Set<string>();
  let malformed = false;
  let nativeSkills: string[] = [];
  let unanchoredChildren = 0;
  for (const [index, session] of sessions.entries()) {
    if (!session) continue;
    malformed ||= codexNativeSessionEntries(session).malformed;
    const readEvents = nativeSkillReadEvents(session);
    for (const event of readEvents)
      for (const skill of eventSkillReads(event, roots, mountedSkills))
        attemptedSkills.add(skill);
    // Pages must belong to one actor; parent and child half-reads cannot combine.
    const nextSkills = observedSkillReads(readEvents, roots, mountedSkills, {
      initialSkills: nativeSkills,
    });
    if (
      index > 0 &&
      nextSkills.some(
        (skill) =>
          !nativeSkills.includes(skill) && !initialSkills.includes(skill),
      )
    )
      unanchoredChildren++;
    nativeSkills = nextSkills;
  }
  return {
    attemptedSkills,
    malformed,
    nativeSkills,
    childrenOrdered: unanchoredChildren <= 1,
  };
}

function appendRetainedSkillReads(
  retained: string,
  skills: string[],
  preOwnerSkills: string[] = [],
  readDiagnostics: Record<string, unknown>[] = [],
): string {
  const existing = new Set(
    retained.split("\n").flatMap((line) => {
      try {
        const record = JSON.parse(line) as Record<string, unknown>;
        return record.type === "darrow.skill_read_probe" &&
          typeof record.skill === "string"
          ? [record.skill]
          : [];
      } catch {
        return [];
      }
    }),
  );
  const additions = skills
    .filter((skill) => !existing.has(skill))
    .map((skill) =>
      JSON.stringify({
        type: "darrow.skill_read_probe",
        source: "skill_file_read_probe",
        skill,
        status: "completed",
      }),
    );
  const preOwner = preOwnerSkills.map((skill) =>
    JSON.stringify({
      type: "darrow.codex_native_pre_owner_skill_read",
      actor: "parent",
      pre_owner_skill: skill,
      status: "completed",
    }),
  );
  return [
    retained,
    ...additions,
    ...preOwner,
    ...readDiagnostics.map((record) => JSON.stringify(record)),
  ]
    .filter(Boolean)
    .join("\n");
}

function nativeReviewAxis(
  taskName: string,
  message: unknown,
): ReviewAxis | undefined {
  const taskAxes = reviewAxesFromTaskName(taskName);
  if (taskAxes.length === 1) return taskAxes[0];
  if (taskAxes.length > 1 || typeof message !== "string") return undefined;
  const firstLine = message.split("\n", 1)[0];
  const match = firstLine?.match(/^- review_axis: (standards|spec)$/);
  return match?.[1] as ReviewAxis | undefined;
}

function isNativeSpawnCall(payload: Record<string, unknown>): boolean {
  return (
    payload.type === "function_call" &&
    payload.name === "spawn_agent" &&
    payload.namespace === "collaboration"
  );
}

function nativeSpawnArguments(
  payload: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return typeof payload.arguments === "string"
    ? parsedRecord(payload.arguments)
    : undefined;
}

function nativeSpawnFields(
  entry: CodexNativeSessionEntry,
): CodexNativeSpawnFields {
  const { payload, ordinal } = entry;
  const callId = boundedCollaborationIdentifier(payload.call_id);
  const args = nativeSpawnArguments(payload);
  const taskName = boundedRouteField(
    args?.task_name,
    /^[a-z0-9][a-z0-9_]{0,63}$/,
  );
  const model = boundedRouteField(
    args?.model,
    /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/,
  );
  const reasoningEffort = boundedRouteField(
    args?.reasoning_effort,
    /^(?:low|medium|high|xhigh|max|ultra)$/,
  );
  const forkTurns = boundedRouteField(
    args?.fork_turns,
    /^(?:none|all|[1-9][0-9]*)$/,
  );
  const reviewAxis = taskName
    ? nativeReviewAxis(taskName, args?.message)
    : undefined;
  return {
    ordinal,
    callId,
    argumentsValid: args !== undefined,
    taskName,
    model,
    reasoningEffort,
    forkTurns,
    reviewAxis,
  };
}

function nativeSpawnRequest(
  entry: CodexNativeSessionEntry,
): CodexNativeSpawnRequest | undefined {
  const fields = nativeSpawnFields(entry);
  if (
    !fields.argumentsValid ||
    [
      fields.callId,
      fields.taskName,
      fields.model,
      fields.reasoningEffort,
      fields.forkTurns,
      fields.reviewAxis,
    ].some((value) => !value)
  )
    return undefined;
  return fields as CodexNativeSpawnRequest;
}

function retainedRejectedNativeSpawn(
  entry: CodexNativeSessionEntry,
): Record<string, unknown> {
  const fields = nativeSpawnFields(entry);
  const reasons = fields.argumentsValid
    ? [
        ["call_id", fields.callId],
        ["task_name", fields.taskName],
        ["model", fields.model],
        ["reasoning_effort", fields.reasoningEffort],
        ["fork_turns", fields.forkTurns],
        ["review_axis", fields.reviewAxis],
      ]
        .filter(([, value]) => !value)
        .map(([reason]) => reason)
    : ["arguments"];
  return {
    type: "darrow.codex_native_spawn",
    status: "unaccepted",
    requested_ordinal: fields.ordinal,
    reasons,
    ...(fields.callId ? { call_id: fields.callId } : {}),
    ...(fields.taskName ? { task_name: fields.taskName } : {}),
    ...(fields.model ? { model: fields.model } : {}),
    ...(fields.reasoningEffort
      ? { reasoning_effort: fields.reasoningEffort }
      : {}),
    ...(fields.forkTurns ? { fork_turns: fields.forkTurns } : {}),
    ...(fields.reviewAxis ? { review_axis: fields.reviewAxis } : {}),
  };
}

function retainedUnclassifiedNativeSpawn(
  entries: CodexNativeSessionEntry[],
  entry: CodexNativeSessionEntry,
  acceptanceAllowed: boolean,
): Record<string, unknown> {
  const record = retainedRejectedNativeSpawn(entry);
  const fields = nativeSpawnFields(entry);
  if (
    !fields.callId ||
    !fields.model ||
    !fields.reasoningEffort ||
    !fields.forkTurns
  )
    return record;
  const request = { callId: fields.callId, ordinal: fields.ordinal };
  const start = nativeSpawnStart(entries, request);
  if (!start) return record;
  const accepted = nativeSpawnAcceptance(entries, request, start.agentRef);
  if (
    accepted === undefined ||
    !isAcceptedNativeSpawn(request, start, accepted, acceptanceAllowed)
  )
    return record;
  // A review role is irrelevant to accepting an ordinary engineering owner.
  return {
    ...record,
    status: "accepted",
    reasons: [],
    role: "unverified",
    agent_ref: start.agentRef,
    thread_id: start.threadId,
    started_ordinal: start.ordinal,
    accepted_ordinal: accepted,
  };
}

function nativeStartedActivity(
  entry: CodexNativeSessionEntry,
  callId: string,
): { ordinal: number; agentRef: string; threadId: string } | undefined {
  if (entry.payload.type !== "item_completed") return undefined;
  const activity = isRecord(entry.payload.item)
    ? entry.payload.item
    : undefined;
  if (activity?.type !== "SubAgentActivity") return undefined;
  if (activity.id !== callId || activity.kind !== "started") return undefined;
  const agentRef = canonicalCodexAgentRef(activity.agent_path);
  const threadId = boundedCollaborationIdentifier(activity.agent_thread_id);
  return agentRef && threadId
    ? { ordinal: entry.ordinal, agentRef, threadId }
    : undefined;
}

function nativeSpawnStart(
  entries: CodexNativeSessionEntry[],
  request: Pick<CodexNativeSpawnRequest, "callId">,
): { ordinal: number; agentRef: string; threadId: string } | undefined {
  const starts = entries
    .map((entry) => nativeStartedActivity(entry, request.callId))
    .filter(
      (
        start,
      ): start is { ordinal: number; agentRef: string; threadId: string } =>
        !!start,
    );
  return starts.length === 1 ? starts[0] : undefined;
}

function nativeSpawnAcceptance(
  entries: CodexNativeSessionEntry[],
  request: Pick<CodexNativeSpawnRequest, "callId">,
  agentRef: string,
): number | undefined {
  const outputs = entries.filter(
    (entry) =>
      entry.payload.type === "function_call_output" &&
      entry.payload.call_id === request.callId,
  );
  if (outputs.length !== 1 || typeof outputs[0]?.payload.output !== "string")
    return undefined;
  const output = parsedRecord(outputs[0].payload.output);
  return output?.task_name === agentRef ? outputs[0].ordinal : undefined;
}

function isAcceptedNativeSpawn(
  request: Pick<CodexNativeSpawnRequest, "ordinal">,
  start: { ordinal: number } | undefined,
  acceptedOrdinal: number | undefined,
  acceptanceAllowed: boolean,
): boolean {
  return (
    acceptanceAllowed &&
    start !== undefined &&
    acceptedOrdinal !== undefined &&
    request.ordinal < start.ordinal &&
    start.ordinal < acceptedOrdinal
  );
}

function retainedNativeSpawn(
  entries: CodexNativeSessionEntry[],
  request: CodexNativeSpawnRequest,
  acceptanceAllowed = true,
): Record<string, unknown> {
  const start = nativeSpawnStart(entries, request);
  const acceptedOrdinal = start
    ? nativeSpawnAcceptance(entries, request, start.agentRef)
    : undefined;
  const accepted = isAcceptedNativeSpawn(
    request,
    start,
    acceptedOrdinal,
    acceptanceAllowed,
  );
  return {
    type: "darrow.codex_native_spawn",
    status: accepted ? "accepted" : "unaccepted",
    call_id: request.callId,
    task_name: request.taskName,
    model: request.model,
    reasoning_effort: request.reasoningEffort,
    fork_turns: request.forkTurns,
    review_axis: request.reviewAxis,
    requested_ordinal: request.ordinal,
    ...(accepted && start && acceptedOrdinal !== undefined
      ? {
          agent_ref: start.agentRef,
          thread_id: start.threadId,
          started_ordinal: start.ordinal,
          accepted_ordinal: acceptedOrdinal,
        }
      : {}),
  };
}

function retainedNativeWait(
  entry: CodexNativeSessionEntry,
): Record<string, unknown> | undefined {
  const { payload, ordinal } = entry;
  if (
    payload.type !== "function_call" ||
    payload.name !== "wait_agent" ||
    payload.namespace !== "collaboration"
  )
    return undefined;
  const callId = boundedCollaborationIdentifier(payload.call_id);
  return callId
    ? { type: "darrow.codex_native_wait", call_id: callId, ordinal }
    : undefined;
}

export function retainedCodexNativeSessionEvidence(
  session: string,
  followUpOrdinal?: number,
  expectedFollowUpPrompt?: string,
): object[] {
  const { entries, malformed } = codexNativeSessionEntries(session);
  const spawns = entries
    .filter((entry) => isNativeSpawnCall(entry.payload))
    .map((entry) => {
      const request = nativeSpawnRequest(entry);
      return request
        ? retainedNativeSpawn(entries, request, !malformed)
        : retainedUnclassifiedNativeSpawn(entries, entry, !malformed);
    });
  const waits = entries
    .map(retainedNativeWait)
    .filter((wait): wait is Record<string, unknown> => !!wait);
  return [
    ...retainedCodexGoalControls(entries),
    ...spawns,
    ...waits,
    ...retainedSingleNativeAgent(
      entries,
      malformed,
      followUpOrdinal,
      expectedFollowUpPrompt,
    ),
    ...(malformed ? [{ type: "darrow.codex_native_session_malformed" }] : []),
  ];
}

/** Host acceptance proves an agent exists, without inferring its private role. */
function retainedSingleNativeAgent(
  entries: CodexNativeSessionEntry[],
  malformed: boolean,
  followUpOrdinal?: number,
  expectedFollowUpPrompt?: string,
): object[] {
  const spawns = entries.filter((entry) => isNativeSpawnCall(entry.payload));
  if (malformed || spawns.length !== 1) return [];
  const fields = nativeSpawnFields(spawns[0]!);
  if (
    !fields.callId ||
    !fields.model ||
    !fields.reasoningEffort ||
    !fields.forkTurns
  )
    return [];
  const request = { callId: fields.callId, ordinal: fields.ordinal };
  const start = nativeSpawnStart(entries, request);
  if (!start) return [];
  const accepted = nativeSpawnAcceptance(entries, request, start.agentRef);
  if (
    accepted === undefined ||
    !isAcceptedNativeSpawn(request, start, accepted, true)
  )
    return [];
  return [
    {
      type: "darrow.codex_native_single_agent_accepted",
      agent_ref: start.agentRef,
      model: fields.model,
      reasoning_effort: fields.reasoningEffort,
      fork_turns: fields.forkTurns,
      role: "unverified",
      accepted_ordinal: accepted,
      accepted_before_follow_up: nativeAcceptanceBeforeFeedback(
        accepted,
        followUpOrdinal,
      ),
    },
    ...retainedNativeFeedback(entries, {
      accepted,
      agentRef: start.agentRef,
      followUpOrdinal,
      expectedFollowUpPrompt,
    }),
    ...entries
      .filter((entry) => nativeParentWork(entry, accepted, start.agentRef))
      .map(retainedNativeParentWork),
  ];
}

function nativeAcceptanceBeforeFeedback(
  acceptedOrdinal: number,
  followUpOrdinal: number | undefined,
): boolean | null {
  return followUpOrdinal === undefined
    ? null
    : acceptedOrdinal <= followUpOrdinal;
}

const PARENT_OPERATION_NAMES = new Set([
  "exec",
  "exec_command",
  "apply_patch",
  "write_stdin",
  "view_image",
  "wait",
  "wait_agent",
  "sleep",
  "curr_time",
  "list_agents",
  "spawn_agent",
  "followup_task",
  "send_message",
  "interrupt_agent",
  "request_user_input",
  "request_user_input_async",
  "create_goal",
  "get_goal",
  "update_goal",
]);

function retainedNativeParentWork(entry: CodexNativeSessionEntry): object {
  const { payload, ordinal } = entry;
  return {
    type: "darrow.codex_native_parent_tool_after_agent",
    ordinal,
    namespace: ["collaboration", "functions", "clock"].includes(
      String(payload.namespace),
    )
      ? payload.namespace
      : "other",
    operation: PARENT_OPERATION_NAMES.has(String(payload.name))
      ? payload.name
      : "other",
  };
}

interface NativeFeedbackContext {
  accepted: number;
  agentRef: string;
  followUpOrdinal?: number;
  expectedFollowUpPrompt?: string;
}

function retainedNativeFeedback(
  entries: CodexNativeSessionEntry[],
  context: NativeFeedbackContext,
): object[] {
  return entries.flatMap((entry) =>
    retainedNativeFeedbackEntry(entries, entry, context),
  );
}

function nativeFeedbackCallAfterAcceptance(
  entry: CodexNativeSessionEntry,
  accepted: number,
): boolean {
  const payload = entry.payload;
  return (
    entry.ordinal > accepted &&
    payload.type === "function_call" &&
    payload.namespace === "collaboration" &&
    ["followup_task", "send_message", "interrupt_agent"].includes(
      String(payload.name),
    )
  );
}

function expectedNativeFeedbackEvidence(
  message: unknown,
  expected: string | undefined,
): Record<string, boolean | string | null> {
  if (expected === undefined) return {};
  // Current native sessions persist collaboration message strings as opaque
  // tokens. Comparing those bytes to the user prompt fabricates a mismatch.
  const representation =
    typeof message !== "string"
      ? "unavailable"
      : /^gAAAAA[A-Za-z0-9_-]+={0,2}$/.test(message)
        ? "encrypted"
        : "plaintext";
  if (representation !== "plaintext")
    return {
      message_representation: representation,
      message_matches_expected: null,
      message_contains_expected: null,
    };
  return {
    message_representation: representation,
    message_matches_expected: message === expected,
    message_contains_expected:
      typeof message === "string" && message.includes(expected),
  };
}

function nativeFeedbackTarget(
  value: unknown,
  agentRef: string,
): string | undefined {
  const canonical = canonicalCodexAgentRef(value);
  if (canonical) return canonical;
  // The host also accepts a direct child's task name relative to /root.
  return typeof value === "string" &&
    /^\/root\/[a-z0-9_]+$/.test(agentRef) &&
    value === agentRef.slice("/root/".length)
    ? agentRef
    : undefined;
}

function retainedNativeFeedbackEntry(
  entries: CodexNativeSessionEntry[],
  entry: CodexNativeSessionEntry,
  context: NativeFeedbackContext,
): object[] {
  if (!nativeFeedbackCallAfterAcceptance(entry, context.accepted)) return [];
  const { payload } = entry;
  const args = nativeSpawnArguments(payload);
  const target = nativeFeedbackTarget(args?.target, context.agentRef);
  const callId = boundedCollaborationIdentifier(payload.call_id);
  if (!target || !callId) return [];
  const outputs = entries.filter(
    (candidate) =>
      candidate.ordinal > entry.ordinal &&
      candidate.payload.type === "function_call_output" &&
      candidate.payload.call_id === callId,
  );
  return [
    {
      type: "darrow.codex_native_feedback",
      tool: payload.name,
      agent_ref: target,
      same_owner: target === context.agentRef,
      ordinal: entry.ordinal,
      after_follow_up:
        context.followUpOrdinal !== undefined &&
        entry.ordinal > context.followUpOrdinal,
      ...expectedNativeFeedbackEvidence(
        args?.message,
        context.expectedFollowUpPrompt,
      ),
      delivery: "unverified",
      response_observed: nativeFeedbackResponseObserved(outputs),
    },
  ];
}

function nativeFeedbackResponseObserved(
  outputs: CodexNativeSessionEntry[],
): boolean {
  return outputs.length === 1 && typeof outputs[0]?.payload.output === "string";
}

function nativeParentWork(
  entry: CodexNativeSessionEntry,
  acceptedOrdinal: number,
  agentRef: string,
) {
  const payload = entry.payload;
  if (
    entry.ordinal <= acceptedOrdinal ||
    (payload.type !== "function_call" && payload.type !== "custom_tool_call")
  )
    return false;
  if (payload.namespace !== "collaboration") return true;
  if (payload.name === "wait_agent") return false;
  if (
    payload.name === "followup_task" ||
    payload.name === "interrupt_agent" ||
    payload.name === "send_message"
  )
    return (
      nativeFeedbackTarget(nativeSpawnArguments(payload)?.target, agentRef) !==
      agentRef
    );
  return true;
}

export function retainedCodexEvidence(
  stream: string,
  repoDir: string,
  status?: CodexRetentionStatus,
  installedSkillsRoot: string | string[] = join(repoDir, ".agents", "skills"),
): string {
  const events = codexEvents(stream);
  const skillsRoots = codexEvidenceSkillRoots(repoDir, installedSkillsRoot);
  const mountedSkills = mountedSkillBodies(repoDir, installedSkillsRoot);
  const retainedSkills = new Set<string>(
    status?.explicitlyInvokedSkill ? [status.explicitlyInvokedSkill] : [],
  );
  const readEvidence = new Map<string, SkillReadEvidence>();
  const state: CodexRetentionState = {
    goalOwnerAccepted: false,
    goalAttestation: undefined,
    postGoalToolIds: new Set<string>(),
    pendingPostGoalCommands: new Set<string>(),
    goalOwnerReference: status?.acceptedAgentRef,
    activationState: "pending",
    goalPersistence: "none",
    waited: false,
    interrupted: false,
    closed: false,
    launchStopRecorded: false,
    objectiveReleased: false,
  };
  const retained = events.flatMap((event) => {
    return [
      ...retainCodexEvent(event, state, repoDir, status),
      ...retainedCodexSkillReads(event, skillsRoots, mountedSkills, {
        retainedSkills,
        readEvidence,
      }),
    ];
  });
  appendCodexRetentionState(retained, state, {
    acceptedOwner: status?.acceptedOwner,
  });
  retained.push(...nativeEvidenceForStatus(status, events));
  if (codexStreamMalformed(stream)) retained.push({ type: "malformed_stream" });
  if (status && status.exitCode !== 0)
    retained.push({
      type: "harness_failure",
      exit_code: status.exitCode,
      stderr_present: status.stderrPresent,
    });
  return retained.map((event) => JSON.stringify(event)).join("\n");
}

function nativeEvidenceForStatus(
  status: CodexRetentionStatus | undefined,
  events: CodexEvent[],
): object[] {
  return status?.nativeSession
    ? retainedCodexNativeSessionEvidence(
        status.nativeSession,
        nativeFollowUpOrdinal(events),
        status.expectedFollowUpPrompt,
      )
    : [];
}

function nativeFollowUpOrdinal(events: CodexEvent[]): number | undefined {
  const boundaries = events.filter(
    (event) => event.type === "darrow.eval.follow_up_turn",
  );
  const ordinal = boundaries[0]?.native_after_ordinal;
  return boundaries.length === 1 &&
    typeof ordinal === "number" &&
    Number.isInteger(ordinal) &&
    ordinal >= 0
    ? ordinal
    : undefined;
}

export async function retainedCodexEvidenceForThread(
  stream: string,
  repoDir: string,
  configRoot: string,
  options: {
    status?: CodexRetentionStatus;
    installedSkillsRoot?: string | string[];
  } = {},
): Promise<string> {
  const installedSkillsRoot =
    options.installedSkillsRoot ?? join(repoDir, ".agents", "skills");
  const initialSkills = codexSkillActivation(
    stream,
    repoDir,
    installedSkillsRoot,
  ).observedSkills;
  const native = await codexNativeSkillEvidence({
    stream,
    repoDir,
    configRoot,
    installedSkillsRoot,
    initialSkills,
  });
  const nativeSession = native.parentSession;
  const status = options.status
    ? { ...options.status, nativeSession }
    : nativeSession
      ? { exitCode: 0, stderrPresent: false, nativeSession }
      : undefined;
  return appendRetainedSkillReads(
    retainedCodexEvidence(stream, repoDir, status, installedSkillsRoot),
    native.additionalSkills,
    native.preOwnerSkills,
    native.readDiagnostics,
  );
}

interface CodexTokenUsage {
  complete: boolean;
  inputTokens: number;
  outputTokens: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function codexUsageCandidate(event: CodexEvent): {
  present: boolean;
  value?: unknown;
} {
  if ("usage" in event) return { present: true, value: event.usage };
  const message = isRecord(event.msg) ? event.msg : undefined;
  const messageInfo = isRecord(message?.info) ? message.info : undefined;
  if (messageInfo && "total_token_usage" in messageInfo)
    return { present: true, value: messageInfo.total_token_usage };
  const info = isRecord(event.info) ? event.info : undefined;
  if (info && "total_token_usage" in info)
    return { present: true, value: info.total_token_usage };
  return { present: false };
}

function normalizedCodexUsage(
  value: unknown,
): { input_tokens: number; output_tokens: number } | null {
  if (!isRecord(value)) return null;
  const input = value.input_tokens;
  const output = value.output_tokens;
  if (
    typeof input !== "number" ||
    !Number.isFinite(input) ||
    input < 0 ||
    typeof output !== "number" ||
    !Number.isFinite(output) ||
    output < 0
  )
    return null;
  return { input_tokens: input, output_tokens: output };
}

/** Codex reports cumulative usage repeatedly; the last report on the stream wins. */
export function codexTokenUsage(stream: string): CodexTokenUsage {
  let lastUsage: unknown;
  let found = false;
  for (const event of codexEvents(stream)) {
    const candidate = codexUsageCandidate(event);
    if (!candidate.present) continue;
    found = true;
    lastUsage = candidate.value;
  }
  const usage = normalizedCodexUsage(lastUsage);
  if (!found || !usage || codexStreamMalformed(stream))
    return { complete: false, inputTokens: 0, outputTokens: 0 };
  return {
    complete: !stream.includes('"type":"darrow.eval.follow_up_turn"'),
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  };
}

interface CodexArgvOptions {
  repoDir: string;
  prompt: string;
  model: string;
  effort: string;
}

export function codexArgv(options: CodexArgvOptions): string[] {
  const { repoDir, prompt, model, effort } = options;
  return [
    "codex",
    "exec",
    prompt,
    "--json",
    "-m",
    model,
    "-c",
    `model_reasoning_effort="${effort}"`,
    "--skip-git-repo-check",
    "--ignore-rules",
    "--dangerously-bypass-hook-trust",
    "--dangerously-bypass-approvals-and-sandbox",
    // Final agent message lands under .git/ so checks can read it without
    // it ever appearing in the model's worktree (same trick as fixture-bin).
    "-o",
    join(repoDir, ".git", "last-message.md"),
  ];
}

interface CodexResumeArgvOptions extends CodexArgvOptions {
  threadId: string;
}

export function codexResumeArgv(options: CodexResumeArgvOptions): string[] {
  const { repoDir, threadId, prompt, model, effort } = options;
  return [
    "codex",
    "exec",
    "resume",
    threadId,
    prompt,
    "--json",
    "-m",
    model,
    "-c",
    `model_reasoning_effort="${effort}"`,
    "--skip-git-repo-check",
    "--ignore-rules",
    "--dangerously-bypass-hook-trust",
    "--dangerously-bypass-approvals-and-sandbox",
    "-o",
    join(repoDir, ".git", "last-message.md"),
  ];
}

async function runCodexPluginCommand(
  argv: string[],
  env: Record<string, string>,
): Promise<string> {
  const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", env });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0)
    throw new Error(`Codex eval plugin setup failed (${code}): ${err.trim()}`);
  return out;
}

interface InstalledCodexEvalPlugins {
  pluginRoots: string[];
  skillsRoots: string[];
}

async function installCodexEvalPlugins(
  repoDir: string,
  env: Record<string, string>,
): Promise<InstalledCodexEvalPlugins> {
  const marketplace = join(repoDir, ".git", "eval-marketplace");
  const catalog = JSON.parse(
    await readFile(
      join(marketplace, ".claude-plugin", "marketplace.json"),
      "utf8",
    ),
  ) as { plugins?: unknown };
  if (!Array.isArray(catalog.plugins) || !catalog.plugins.length)
    throw new Error("Codex eval marketplace has no plugins");
  await runCodexPluginCommand(
    ["codex", "plugin", "marketplace", "add", marketplace, "--json"],
    env,
  );
  const pluginRoots: string[] = [];
  const skillsRoots: string[] = [];
  for (const entry of catalog.plugins) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { name?: unknown }).name !== "string" ||
      !(entry as { name: string }).name
    ) {
      throw new Error("Codex eval marketplace has an invalid plugin entry");
    }
    const name = (entry as { name: string }).name;
    const installed = JSON.parse(
      await runCodexPluginCommand(
        ["codex", "plugin", "add", `${name}@darrow-eval`, "--json"],
        env,
      ),
    ) as { installedPath?: unknown };
    if (typeof installed.installedPath !== "string" || !installed.installedPath)
      throw new Error(`Codex eval plugin install returned no path for ${name}`);
    const pluginRoot = await realpath(resolve(installed.installedPath));
    pluginRoots.push(pluginRoot);
    skillsRoots.push(await realpath(join(pluginRoot, "skills")));
  }
  return { pluginRoots, skillsRoots };
}

export async function codexEvalSkillsRoot(
  repoDir: string,
  env: Record<string, string>,
): Promise<string> {
  const catalog = join(
    repoDir,
    ".git",
    "eval-marketplace",
    ".claude-plugin",
    "marketplace.json",
  );
  if (!existsSync(catalog)) return join(repoDir, ".git", "eval-no-skills");
  const installed = await installCodexEvalPlugins(repoDir, env);
  return installed.skillsRoots[0] ?? join(repoDir, ".git", "eval-no-skills");
}

async function codexFinalMessage(repoDir: string): Promise<string> {
  try {
    return await readFile(join(repoDir, ".git", "last-message.md"), "utf8");
  } catch {
    // A missing final message is observable to output checks and raw output.
    return "";
  }
}

export async function codexInitialResponseEvidence(repoDir: string): Promise<{
  initial_response_text: string;
  initial_response_truncated: boolean;
}> {
  const response = await codexFinalMessage(repoDir);
  return {
    initial_response_text: response.slice(0, 8000),
    initial_response_truncated: response.length > 8000,
  };
}

interface CodexExecution {
  canonicalRepoDir: string;
  configRoot: string;
  installedSkillsRoots: string[];
  out: string;
  err: string;
  code: number;
  durationMs: number;
  spawnGuardSecret?: string;
  adaptiveDeliveryPreflightPath?: string;
  acceptedAgentRef?: string;
  acceptedOwner?: AcceptedCodexOwner;
}

interface CodexSpawnGuard {
  secret: string;
  executablePath: string;
  writeDeniedPaths: string[];
  statePath: string;
}

interface CodexSpawnGuardPolicy {
  secret: string;
  baselineSha256: string;
  fixtureStateSha256: string;
  requestSha256: string;
  objectiveRoot: string;
  adaptiveDeliveryPreflightPath: string;
  statePath: string;
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

async function installCodexSpawnGuard(
  repoDir: string,
  env: Record<string, string>,
  options: {
    prompt: string;
    objectiveRoot: string;
    adaptiveDeliveryPreflightPath: string;
  },
): Promise<CodexSpawnGuard> {
  const configRoot = env.CODEX_HOME;
  if (!configRoot) throw new Error("Codex eval has no isolated config root");
  const runtimeDir = join(repoDir, ".git", "darrow-eval", "codex-guard");
  await mkdir(runtimeDir, { recursive: true });
  const wrapperPath = join(runtimeDir, "codex-spawn-guard-entry.ts");
  const executablePath = join(runtimeDir, "codex-spawn-guard");
  const statePath = join(runtimeDir, "state");
  const hooksPath = join(configRoot, "hooks.json");
  const policy: CodexSpawnGuardPolicy = {
    secret: randomBytes(32).toString("hex"),
    baselineSha256: await repositoryFingerprint(repoDir),
    fixtureStateSha256: await fixtureStateFingerprint(repoDir),
    requestSha256: createHash("sha256").update(options.prompt).digest("hex"),
    objectiveRoot: options.objectiveRoot,
    adaptiveDeliveryPreflightPath: options.adaptiveDeliveryPreflightPath,
    statePath,
  };
  await compileCodexSpawnGuard(wrapperPath, executablePath, policy);
  await writeCodexSpawnHook(hooksPath, executablePath);
  return {
    secret: policy.secret,
    executablePath,
    writeDeniedPaths: [hooksPath],
    statePath,
  };
}

async function compileCodexSpawnGuard(
  wrapperPath: string,
  executablePath: string,
  policy: CodexSpawnGuardPolicy,
): Promise<void> {
  const guardSource = join(import.meta.dir, "..", "codex-spawn-guard.ts");
  await writeFile(
    wrapperPath,
    [
      `import { guardCodexSpawn } from ${JSON.stringify(guardSource)};`,
      "const input = JSON.parse(await new Response(Bun.stdin.stream()).text());",
      `const result = await guardCodexSpawn(input, ${JSON.stringify(policy)});`,
      "if (result) process.stdout.write(`${JSON.stringify(result)}\\n`);",
      "",
    ].join("\n"),
    { mode: 0o400 },
  );
  const build = Bun.spawn(
    [
      process.execPath,
      "build",
      "--compile",
      wrapperPath,
      "--outfile",
      executablePath,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [buildOut, buildErr, buildCode] = await Promise.all([
    new Response(build.stdout).text(),
    new Response(build.stderr).text(),
    build.exited,
  ]);
  await rm(wrapperPath, { force: true });
  if (buildCode !== 0)
    throw new Error(
      `cannot compile Codex spawn guard: ${buildErr.trim() || buildOut.trim()}`,
    );
  await chmod(executablePath, 0o500);
}

async function writeCodexSpawnHook(
  hooksPath: string,
  executablePath: string,
): Promise<void> {
  await writeFile(
    hooksPath,
    `${JSON.stringify({
      hooks: {
        PreToolUse: ["Agent", "Bash", "apply_patch"].map((matcher) => ({
          matcher,
          hooks: [
            {
              type: "command",
              command: shellSingleQuote(executablePath),
              timeout: 30,
            },
          ],
        })),
      },
    })}\n`,
    { mode: 0o400 },
  );
}

interface CodexProcessContext {
  canonicalRepoDir: string;
  installedSkillsRoots: string[];
  installedPluginRoots: string[];
  adaptiveDeliveryPreflightPath?: string;
  objectiveRoot: string;
  env: Record<string, string>;
  spawnGuard?: CodexSpawnGuard;
}

export function codexSpawnGuardRequested(
  prompt: string,
  followUpPrompt?: string,
): boolean {
  return [prompt, followUpPrompt].some((value) =>
    value?.includes("adaptive-delivery"),
  );
}

async function installedCodexPluginContext(
  repoDir: string,
  env: Record<string, string>,
) {
  const catalog = join(
    repoDir,
    ".git",
    "eval-marketplace",
    ".claude-plugin",
    "marketplace.json",
  );
  const installed = existsSync(catalog)
    ? await installCodexEvalPlugins(repoDir, env)
    : { pluginRoots: [], skillsRoots: [] };
  return {
    installedSkillsRoots: installed.skillsRoots.length
      ? installed.skillsRoots
      : [join(repoDir, ".git", "eval-no-skills")],
    installedPluginRoots: installed.pluginRoots,
  };
}

/** Historical step attestations require their actual shell helper. */
export async function legacyAdaptiveDeliveryPreflight(
  pluginRoots: string[],
): Promise<string | undefined> {
  const candidate = pluginRoots
    .map((root) => join(root, "bin", "adaptive-delivery-preflight"))
    .find((path) => existsSync(path));
  return candidate ? await realpath(candidate) : undefined;
}

async function codexProcessContext(
  repoDir: string,
  prompt: string,
  enableSpawnGuard: boolean,
): Promise<CodexProcessContext> {
  const canonicalRepoDir = await realpath(repoDir);
  const env = await isolatedHarnessEnvironment("codex", repoDir);
  const objectiveRoot = await realpath(
    await mkdtemp(
      join(process.env.TMPDIR ?? "/tmp", "darrow-codex-objective-"),
    ),
  );
  env.TMPDIR = objectiveRoot;
  const { installedSkillsRoots, installedPluginRoots } =
    await installedCodexPluginContext(repoDir, env);
  const adaptiveDeliveryPreflightPath =
    await legacyAdaptiveDeliveryPreflight(installedPluginRoots);
  const spawnGuard =
    adaptiveDeliveryPreflightPath && enableSpawnGuard
      ? await installCodexSpawnGuard(canonicalRepoDir, env, {
          prompt,
          objectiveRoot,
          adaptiveDeliveryPreflightPath,
        })
      : undefined;
  return {
    canonicalRepoDir,
    installedSkillsRoots,
    installedPluginRoots,
    adaptiveDeliveryPreflightPath,
    objectiveRoot,
    env,
    spawnGuard,
  };
}

interface CodexProcessOutput {
  out: string;
  err: string;
  code: number;
}

async function codexTurnOutput(options: {
  request: HarnessRunRequest;
  initial: CodexProcessOutput;
  sandboxed: (argv: string[]) => Promise<string[]>;
  env: Record<string, string>;
  initialRepositoryFingerprint: string;
}): Promise<CodexProcessOutput> {
  const { request, initial, sandboxed, env } = options;
  const followUpPrompt = request.control?.followUpPrompt;
  if (!followUpPrompt || !codexRunSucceeded(initial.code, initial.out))
    return initial;
  const threadId = codexThreadId(initial.out);
  if (!threadId)
    throw new Error(
      "Codex follow-up eval could not identify exactly one initial thread",
    );
  const nativeAfterOrdinal = await nativeSessionLastOrdinal(
    env.CODEX_HOME!,
    threadId,
  );
  const preFeedbackWorktreeUnchanged =
    options.initialRepositoryFingerprint ===
    (await repositoryFingerprint(request.repoDir));
  // The resume command writes to the same last-message file.
  const initialResponse = await codexInitialResponseEvidence(request.repoDir);
  const resumed = await runCodexProcess(
    await sandboxed(
      codexResumeArgv({ ...request, threadId, prompt: followUpPrompt }),
    ),
    request.repoDir,
    env,
  );
  const boundary = JSON.stringify({
    type: "darrow.eval.follow_up_turn",
    thread_id: threadId,
    native_after_ordinal: nativeAfterOrdinal,
    pre_feedback_worktree_unchanged: preFeedbackWorktreeUnchanged,
    ...initialResponse,
  });
  return {
    out: [initial.out.trimEnd(), boundary, resumed.out.trimStart()].join("\n"),
    err: [initial.err.trimEnd(), resumed.err.trimStart()]
      .filter(Boolean)
      .join("\n"),
    code: resumed.code,
  };
}

async function nativeSessionLastOrdinal(
  configRoot: string,
  threadId: string,
): Promise<number | undefined> {
  const session = await codexNativeSessionForThread(configRoot, threadId);
  if (!session) return undefined;
  const parsed = codexNativeSessionEntries(session);
  return parsed.malformed || !parsed.entries.length
    ? undefined
    : Math.max(...parsed.entries.map((entry) => entry.ordinal));
}

function codexSandboxedCommand(
  context: Awaited<ReturnType<typeof codexProcessContext>>,
  repoDir: string,
): (argv: string[]) => Promise<string[]> {
  const deniedPaths = [
    ...(context.spawnGuard?.writeDeniedPaths ?? []),
    join(context.canonicalRepoDir, ".git", "fixture-bin"),
    ...context.installedPluginRoots,
  ];
  const allowedExecutables = context.spawnGuard
    ? [context.spawnGuard.executablePath]
    : [];
  return (argv) =>
    sandboxedAgentCommand(argv, repoDir, deniedPaths, allowedExecutables);
}

export function codexSpawnGuardEnabled(request: HarnessRunRequest): boolean {
  return (
    request.control?.ownerEvaluationMode !== "passive" &&
    (request.control?.expectGoalOwner === true ||
      codexSpawnGuardRequested(request.prompt, request.control?.followUpPrompt))
  );
}

function codexProcessContextForRequest(request: HarnessRunRequest) {
  return codexProcessContext(
    request.repoDir,
    request.prompt,
    codexSpawnGuardEnabled(request),
  );
}

async function filesBeneath(root: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return filesBeneath(path);
      return entry.isFile() ? [path] : [];
    }),
  );
  return nested.flat();
}

export async function codexNativeSessionForThread(
  configRoot: string,
  threadId: string,
): Promise<string | undefined> {
  const boundedThread = boundedCollaborationIdentifier(threadId);
  if (!boundedThread) return undefined;
  const suffix = `-${boundedThread}.jsonl`;
  const matches = (await filesBeneath(join(configRoot, "sessions"))).filter(
    (path) => path.endsWith(suffix),
  );
  if (matches.length !== 1) return undefined;
  try {
    return await readFile(matches[0]!, "utf8");
  } catch {
    return undefined;
  }
}

async function executeCodex(
  request: HarnessRunRequest,
): Promise<CodexExecution> {
  const start = performance.now();
  const { repoDir } = request;
  const context = await codexProcessContextForRequest(request);
  const { env, spawnGuard } = context;
  const sandboxed = codexSandboxedCommand(context, repoDir);
  try {
    const initialRepositoryFingerprint = await repositoryFingerprint(repoDir);
    const initial = await runCodexProcess(
      await sandboxed(codexArgv(request)),
      repoDir,
      env,
    );
    const { out, err, code } = await codexTurnOutput({
      request,
      initial,
      sandboxed,
      env,
      initialRepositoryFingerprint,
    });
    const acceptedOwner = spawnGuard
      ? await verifiedCodexAcceptedOwner(
          spawnGuard.statePath,
          spawnGuard.secret,
          completedGoalOwnerAgentRef(out),
        )
      : undefined;
    return {
      canonicalRepoDir: context.canonicalRepoDir,
      configRoot: env.CODEX_HOME!,
      installedSkillsRoots: context.installedSkillsRoots,
      out,
      err,
      code,
      durationMs: performance.now() - start,
      spawnGuardSecret: spawnGuard?.secret,
      adaptiveDeliveryPreflightPath: context.adaptiveDeliveryPreflightPath,
      acceptedAgentRef: acceptedOwner?.agentRef,
      acceptedOwner,
    };
  } finally {
    await rm(context.objectiveRoot, { recursive: true, force: true });
  }
}

async function runCodexProcess(
  argv: string[],
  repoDir: string,
  env: Record<string, string>,
): Promise<{ out: string; err: string; code: number }> {
  throwIfInterrupted();
  const proc = trackEvaluationProcess(
    Bun.spawn(argv, {
      detached: true,
      cwd: repoDir,
      stdout: "pipe",
      stderr: "pipe",
      // Fixture mocks shadow real network tools for the harness and children.
      env: {
        ...env,
        DARROW_ADAPTIVE_DELIVERY_EXTERNAL_SANDBOX: "1",
        PATH: `${join(repoDir, ".git", "fixture-bin")}:${env.PATH ?? ""}`,
      },
    }),
  );
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { out, err, code };
}

function codexActivationForRequest(
  request: HarnessRunRequest,
  execution: CodexExecution,
): SkillActivationObservation {
  const activationProbe = request.control?.activationProbe;
  if (activationProbe?.mode !== "explicit") {
    return codexSkillActivation(
      execution.out,
      execution.canonicalRepoDir,
      execution.installedSkillsRoots,
    );
  }
  return codexExplicitSkillActivation(
    execution.out,
    [request.prompt, request.control?.followUpPrompt]
      .filter((value): value is string => value !== undefined)
      .join("\n"),
    activationProbe,
    {
      repoDir: execution.canonicalRepoDir,
      installedSkillsRoots: execution.installedSkillsRoots,
    },
  );
}

function codexRetentionStatus(
  request: HarnessRunRequest,
  execution: CodexExecution,
): CodexRetentionStatus {
  return {
    exitCode: execution.code,
    stderrPresent: execution.err.trim().length > 0,
    explicitlyInvokedSkill:
      request.control?.activationProbe?.mode === "explicit"
        ? request.control.activationProbe.skill
        : undefined,
    expectedFollowUpPrompt: request.control?.followUpPrompt,
    spawnGuardSecret: execution.spawnGuardSecret,
    adaptiveDeliveryPreflightPath: execution.adaptiveDeliveryPreflightPath,
    acceptedAgentRef: execution.acceptedAgentRef,
    acceptedOwner: execution.acceptedOwner,
  };
}

async function codexHarnessResult(
  request: HarnessRunRequest,
  execution: CodexExecution,
): Promise<HarnessResult> {
  const { out, code, durationMs, spawnGuardSecret } = execution;
  const usage = codexTokenUsage(out);
  const ok = codexRunSucceeded(code, out);
  const resultText = await codexFinalMessage(request.repoDir);
  const { activation, raw } = await codexHarnessActivationEvidence(
    request,
    execution,
  );
  return {
    evaluationEnforcement: spawnGuardSecret ? "enforced" : "passive",
    ...codexAgentConcurrencyEvidence("codex"),
    ok,
    durationMs,
    tokenUsageComplete: codexUsageCoversExecution(usage.complete, raw),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: null,
    resultText,
    raw,
    skillActivation: { ...activation, complete: ok && activation.complete },
  };
}

export async function codexHarnessActivationEvidence(
  request: HarnessRunRequest,
  execution: CodexExecution,
): Promise<{ activation: SkillActivationObservation; raw: string }> {
  const { canonicalRepoDir, configRoot, installedSkillsRoots, out } = execution;
  const streamActivation = codexActivationForRequest(request, execution);
  const native = await codexNativeSkillEvidence({
    stream: out,
    repoDir: canonicalRepoDir,
    configRoot,
    installedSkillsRoot: installedSkillsRoots,
    initialSkills: streamActivation.observedSkills,
    explicitPrimary:
      streamActivation.source === "explicit_invocation"
        ? (streamActivation.primarySkill ?? undefined)
        : undefined,
  });
  const activation = reconciledSkillActivation(
    request,
    execution,
    streamActivation,
    native,
  );
  const raw = appendRetainedSkillReads(
    retainedCodexEvidence(
      out,
      canonicalRepoDir,
      {
        ...codexRetentionStatus(request, execution),
        nativeSession: native.parentSession,
      },
      installedSkillsRoots,
    ),
    native.additionalSkills,
    native.preOwnerSkills,
    native.readDiagnostics,
  );
  return { activation, raw };
}

function reconciledSkillActivation(
  request: HarnessRunRequest,
  execution: CodexExecution,
  streamActivation: SkillActivationObservation,
  native: CodexNativeSkillEvidence,
): SkillActivationObservation {
  const explicit = request.control?.activationProbe?.mode === "explicit";
  return {
    ...streamActivation,
    primarySkill: explicit
      ? streamActivation.primarySkill
      : (native.observedSkills[0] ?? streamActivation.primarySkill),
    observedSkills: native.observedSkills,
    complete:
      !native.malformed &&
      native.orderConsistent &&
      (explicit
        ? explicitRecoveredReadsComplete(request, execution, native)
        : streamActivation.complete),
  };
}

function explicitRecoveredReadsComplete(
  request: HarnessRunRequest,
  execution: CodexExecution,
  native: CodexNativeSkillEvidence,
): boolean {
  const { canonicalRepoDir, installedSkillsRoots, out } = execution;
  const probe = request.control?.activationProbe;
  if (probe?.mode === "explicit") {
    const dispatch = codexExplicitSkillActivation(
      out,
      [request.prompt, request.control?.followUpPrompt]
        .filter((value) => value !== undefined)
        .join("\n"),
      probe,
    );
    const mounted = mountedSkillBodies(canonicalRepoDir, installedSkillsRoots);
    const roots = codexTrackedSkillRoots(
      canonicalRepoDir,
      installedSkillsRoots,
    );
    const attempted = [
      ...native.attemptedSkills,
      ...codexEvents(out).flatMap((event) =>
        eventSkillReads(event, roots, mounted),
      ),
    ].filter((skill) => mounted.some(({ name }) => name === skill));
    return (
      dispatch.complete &&
      attempted.every((skill) => native.observedSkills.includes(skill))
    );
  }
  return false;
}

/** Child usage is not reconciled by the native acceptance observer. */
export function codexUsageCoversExecution(
  complete: boolean,
  raw: string,
): boolean {
  return (
    complete &&
    !codexEvents(raw).some(
      (event) =>
        event.type === "darrow.codex_native_spawn" ||
        event.type === "darrow.codex_native_single_agent_accepted" ||
        event.type === "darrow.goal_owner_accepted" ||
        event.item?.tool === "spawn_agent",
    )
  );
}

/**
 * Runs the skill via headless Codex (`codex exec`). The fixture source is
 * installed into the isolated Codex plugin cache through a local marketplace,
 * matching installed-plugin discovery without a shadowing project skill.
 * Native approvals are bypassed inside the runner's outer OS sandbox.
 * Codex reports token usage in its JSONL event stream but no cost — costUsd
 * stays null for this adapter.
 */
export const codexAdapter: HarnessAdapter = {
  name: "codex",
  defaultModel: CODEX_EVAL_ROLE_DEFAULTS.candidate.model,
  skillMounts: [],
  sourceCodexPlugin: true,

  async version(): Promise<string> {
    const proc = Bun.spawn(["codex", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    return out.trim();
  },

  async run(request): Promise<HarnessResult> {
    return codexHarnessResult(request, await executeCodex(request));
  },
};
