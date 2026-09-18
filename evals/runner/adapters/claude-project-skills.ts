import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  SkillActivationProbe,
  SkillActivationObservation,
} from "../types";

interface NativeEntry {
  type?: string;
  isMeta?: boolean;
  isSidechain?: boolean;
  sessionId?: string;
  message?: { content?: string | Array<{ type?: string; text?: string }> };
}
export interface ProjectSkillReceipt {
  type:
    | "darrow.claude_project_skill_invocation"
    | "darrow.claude_plugin_skill_invocation";
  skill: string;
  accepted: boolean | null;
  reason: string;
}
function projectReceipt(
  skill: string,
  accepted: boolean | null,
  reason: string,
  plugin = false,
): ProjectSkillReceipt {
  return {
    type: plugin
      ? "darrow.claude_plugin_skill_invocation"
      : "darrow.claude_project_skill_invocation",
    skill,
    accepted,
    reason,
  };
}
function nativeEntries(transcript: string): NativeEntry[] {
  return transcript
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}
function projectSessionId(stream: string): string | undefined {
  const entries = stream
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const sessions = [
    ...new Set(
      entries
        .filter(
          (event) =>
            (event.type === "system" && event.subtype === "init") ||
            event.type === "result",
        )
        .map((event) => event.session_id)
        .filter((id) => typeof id === "string"),
    ),
  ];
  return sessions.length === 1 && /^[a-zA-Z0-9_-]+$/.test(sessions[0]!)
    ? sessions[0]
    : undefined;
}
export function projectSkillActivation(
  observation: SkillActivationObservation,
  receipt: ProjectSkillReceipt,
): SkillActivationObservation {
  // Native expansion is an additional observation path for plugin skills.
  if (
    receipt.type === "darrow.claude_plugin_skill_invocation" &&
    receipt.accepted !== true &&
    observation.observedSkills.includes(receipt.skill)
  )
    return observation;
  const observedSkills =
    receipt.accepted === true
      ? [
          receipt.skill,
          ...observation.observedSkills.filter(
            (skill) => skill !== receipt.skill,
          ),
        ]
      : observation.observedSkills;
  return {
    source: "explicit_invocation",
    complete: observation.complete && receipt.accepted === true,
    primarySkill: observedSkills[0] ?? null,
    observedSkills,
  };
}
function content(entry: NativeEntry): string {
  const value = entry.message?.content;
  return typeof value === "string"
    ? value
    : (value ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n");
}
function isAssistant(entry: NativeEntry): boolean {
  return entry.type === "assistant";
}

function commandMismatch(
  entry: NativeEntry,
  sessionId: string,
  expected: string,
): boolean {
  return !!(
    entry.isMeta ||
    entry.isSidechain ||
    entry.sessionId !== sessionId ||
    content(entry) !== expected
  );
}

function invalidExpansion(
  expanded: NativeEntry[],
  before: NativeEntry[],
  called: NativeEntry,
  sessionId: string,
): boolean {
  if (expanded.length !== 1) return true;
  const entry = expanded[0]!;
  return (
    entry.isMeta !== true ||
    !!entry.isSidechain ||
    entry.sessionId !== sessionId ||
    before.indexOf(entry) <= before.indexOf(called)
  );
}

interface ProjectInvocationInput {
  transcript: string;
  sessionId: string;
  skill: string;
  skillDir: string;
  skillText: string;
  prompt: string;
  /** Canonical native command, resolved from the mounted plugin manifest. */
  commandName?: string;
}

function expectedNativeCommand(input: ProjectInvocationInput) {
  const name = input.commandName ?? input.skill;
  const invocation = `/${name}`;
  const supplied = [`/${input.skill}`, invocation].find(
    (token) => input.prompt === token || input.prompt.startsWith(token + " "),
  );
  if (!supplied) return undefined;
  const args = input.prompt.slice(supplied.length).trim();
  const command = `<command-message>${name}</command-message>\n<command-name>${invocation}</command-name>`;
  return {
    invocation,
    content: command + (args ? `\n<command-args>${args}</command-args>` : ""),
  };
}
/** Inspect exact host expansion before the first assistant turn; retain no text. */
export function matchClaudeProjectInvocation(
  input: ProjectInvocationInput,
): ProjectSkillReceipt {
  const receipt = (accepted: boolean | null, reason: string) =>
    projectReceipt(
      input.skill,
      accepted,
      reason,
      input.commandName !== undefined,
    );
  let entries: NativeEntry[];
  try {
    entries = nativeEntries(input.transcript);
  } catch {
    return receipt(null, "malformed native transcript");
  }
  const expected = expectedNativeCommand(input);
  if (!expected) return receipt(false, "prompt is not this mounted command");
  const firstAssistant = entries.findIndex(isAssistant);
  if (firstAssistant < 0) return receipt(null, "missing assistant turn");
  const before = entries.slice(0, firstAssistant);
  const commands = before.filter(
    (entry) =>
      entry.type === "user" &&
      content(entry).includes(
        `<command-name>${expected.invocation}</command-name>`,
      ),
  );
  if (commands.length !== 1)
    return receipt(false, "missing or duplicate native command");
  const called = commands[0]!;
  if (commandMismatch(called, input.sessionId, expected.content))
    return receipt(false, "command session or arguments differ");
  const body = input.skillText
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .trim();
  if (!body) return receipt(null, "empty mounted skill body");
  const prefix = `Base directory for this skill: ${input.skillDir}\n\n${body}`;
  const expanded = before.filter(
    (entry) => entry.type === "user" && content(entry).startsWith(prefix),
  );
  if (invalidExpansion(expanded, before, called, input.sessionId))
    return receipt(
      false,
      "missing, partial, duplicate, or uncorrelated body expansion",
    );
  return receipt(true, "native command and complete mounted body matched");
}

async function mountedCommand(repo: string, skill: string) {
  const projectDir = join(repo, ".claude/skills", skill);
  try {
    return {
      skillDir: projectDir,
      skillText: await readFile(join(projectDir, "SKILL.md"), "utf8"),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const plugin = join(repo, ".git", "eval-plugin");
  const manifest = JSON.parse(
    await readFile(join(plugin, ".claude-plugin", "plugin.json"), "utf8"),
  ) as { name?: unknown };
  if (typeof manifest.name !== "string" || !/^[a-z0-9-]+$/.test(manifest.name))
    throw new Error("invalid mounted plugin name");
  const skillDir = join(plugin, "skills", skill);
  return {
    skillDir,
    skillText: await readFile(join(skillDir, "SKILL.md"), "utf8"),
    commandName: `${manifest.name}:${skill}`,
  };
}

export async function observeClaudeProjectInvocation(input: {
  repo: string;
  configRoot: string;
  stream: string;
  prompt: string;
  probe?: SkillActivationProbe;
}): Promise<ProjectSkillReceipt | undefined> {
  if (
    input.probe?.mode !== "explicit" ||
    !input.prompt.startsWith(input.probe.invocation)
  )
    return undefined;
  const skill = input.probe.skill;
  if (!/^[a-z0-9-]+$/.test(skill)) return undefined;
  let mounted: Awaited<ReturnType<typeof mountedCommand>>;
  try {
    mounted = await mountedCommand(input.repo, skill);
  } catch {
    return projectReceipt(skill, null, "mounted skill identity unavailable");
  }
  const receipt = (reason: string) =>
    projectReceipt(skill, null, reason, mounted.commandName !== undefined);
  try {
    const sessionId = projectSessionId(input.stream);
    if (!sessionId)
      return receipt("missing or ambiguous host session identity");
    const project = input.repo.replace(/[^A-Za-z0-9]/g, "-");
    const transcript = await readFile(
      join(input.configRoot, "projects", project, `${sessionId}.jsonl`),
      "utf8",
    );
    return matchClaudeProjectInvocation({
      transcript,
      sessionId,
      skill,
      ...mounted,
      prompt: input.prompt,
    });
  } catch {
    return receipt("native session evidence unavailable");
  }
}
