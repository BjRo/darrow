#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { TICKETCTL } from "../fixture-ticket";

type RecordValue = Record<string, unknown>;

function record(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as RecordValue;
}

function keys(value: RecordValue, allowed: string[], label: string): void {
  const unsupported = Object.keys(value).filter(
    (key) => !allowed.includes(key),
  );
  if (unsupported.length)
    throw new Error(
      `${label} uses unsupported fields: ${unsupported.join(", ")}`,
    );
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} must be a nonempty string`);
  return value;
}

function files(value: unknown, label: string): Record<string, string> {
  const entries = record(value, label);
  if (Object.values(entries).some((item) => typeof item !== "string"))
    throw new Error(`${label} must contain text files`);
  return entries as Record<string, string>;
}

function fixtureHooks(fixture: RecordValue) {
  return fixture.hooks === undefined
    ? {}
    : { hooks: files(fixture.hooks, "fixture Git hooks") };
}

function fixtureTicket(fixture: RecordValue) {
  if (fixture.ticket === undefined) return null;
  const value = record(fixture.ticket, "fixture ticket");
  keys(value, ["id", "title", "body"], "fixture ticket");
  if (typeof value.title !== "string" || typeof value.body !== "string")
    throw new Error("fixture ticket title and body must be text");
  const ticket = {
    id: string(value.id, "fixture ticket ID"),
    title: value.title,
    body: value.body,
  };
  if (!/^[A-Za-z0-9._-]+$/.test(ticket.id) || ticket.id.length > 128)
    throw new Error("fixture ticket ID is invalid");
  if (/[\r\n\0]/.test(ticket.title) || ticket.title.length > 512)
    throw new Error("fixture ticket title must be one line");
  if (ticket.body.includes("\0") || Buffer.byteLength(ticket.body) > 8 * 1024)
    throw new Error("fixture ticket body exceeds the size limit");
  return ticket;
}

function fixtureBin(
  fixture: RecordValue,
  ticket: ReturnType<typeof fixtureTicket>,
) {
  const bin =
    fixture.bin === undefined ? {} : files(fixture.bin, "fixture binaries");
  return fixture.bin === undefined && !ticket
    ? {}
    : { bin: { ...bin, ...(ticket ? { ticketctl: TICKETCTL } : {}) } };
}

function fixtureOverlay(
  fixture: RecordValue,
  ticket: ReturnType<typeof fixtureTicket>,
) {
  const overlay =
    fixture.files === undefined
      ? undefined
      : files(fixture.files, "fixture files");
  if (
    fixture.staged !== undefined &&
    (!Array.isArray(fixture.staged) ||
      !fixture.staged.every((path) => typeof path === "string"))
  )
    throw new Error("fixture staged paths are invalid");
  if (
    fixture.commit_files !== undefined &&
    typeof fixture.commit_files !== "boolean"
  )
    throw new Error("fixture commit_files must be a boolean");
  return {
    ...(overlay ? { files: overlay } : {}),
    ...(fixture.staged ? { staged: fixture.staged } : {}),
    ...(fixture.commit_files ? { commitFiles: true } : {}),
    ...fixtureHooks(fixture),
    ...fixtureBin(fixture, ticket),
  };
}

function generatedFixture(
  value: unknown,
  ticket: ReturnType<typeof fixtureTicket>,
) {
  const fixture = record(value, "fixture");
  keys(
    fixture,
    [
      "commits",
      "files",
      "staged",
      "commit_files",
      "hooks",
      "bin",
      "setup",
      "ticket",
    ],
    "fixture",
  );
  if (!Array.isArray(fixture.commits) || !fixture.commits.length)
    throw new Error("case needs a generated Git history");
  const commits = fixture.commits.map((entry, index) => {
    const commit = record(entry, `commit ${index + 1}`);
    keys(commit, ["message", "files"], `commit ${index + 1}`);
    return {
      message: string(commit.message, `commit ${index + 1} message`),
      files: files(commit.files, `commit ${index + 1} files`),
    };
  });
  return {
    kind: "generated" as const,
    commits,
    ...fixtureOverlay(fixture, ticket),
  };
}

function repositoryFixture(
  fixture: RecordValue,
  ticket: ReturnType<typeof fixtureTicket>,
) {
  keys(
    fixture,
    [
      "source",
      "files",
      "staged",
      "commit_files",
      "hooks",
      "bin",
      "setup",
      "ticket",
    ],
    "fixture",
  );
  const sourceRef = string(fixture.source, "fixture source");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(sourceRef))
    throw new Error("fixture source ID is invalid");
  return {
    kind: "repository" as const,
    sourceRef,
    ...fixtureOverlay(fixture, ticket),
  };
}

function fixtureSetupScript(fixture: RecordValue): string | null {
  if (fixture.setup === undefined) return null;
  const script = string(fixture.setup, "fixture setup");
  if (Buffer.byteLength(script, "utf8") > 60 * 1024)
    throw new Error("fixture setup exceeds the size limit");
  return script;
}

function caseFixture(value: unknown) {
  const fixture = record(value, "fixture");
  const setup = fixtureSetupScript(fixture);
  const ticket = fixtureTicket(fixture);
  return {
    fixture:
      fixture.source === undefined
        ? generatedFixture(fixture, ticket)
        : repositoryFixture(fixture, ticket),
    ...(setup
      ? { setupDigest: createHash("sha256").update(setup).digest("hex") }
      : {}),
    ...(ticket
      ? {
          ticketDigest: createHash("sha256")
            .update(JSON.stringify(ticket))
            .digest("hex"),
        }
      : {}),
  };
}

function shellChecks(value: unknown) {
  if (!Array.isArray(value)) throw new Error("case checks must be an array");
  return value.map((entry, index) => {
    const check = record(entry, `check ${index + 1}`);
    keys(
      check,
      [
        "name",
        "run",
        "expect_exact",
        "expect_regex",
        "not_regex",
        "flags",
        "exit_code",
        "expect_exit",
        "metric",
      ],
      `check ${index + 1}`,
    );
    string(check.name, `check ${index + 1} name`);
    const run = string(check.run, `check ${index + 1} run`);
    if (check.exit_code !== undefined && check.expect_exit !== undefined)
      throw new Error(`check ${index + 1} declares both exit code fields`);
    const configuration = {
      run,
      ...(check.exit_code === undefined && check.expect_exit === undefined
        ? {}
        : { expectedExitCode: check.exit_code ?? check.expect_exit }),
      ...(check.expect_exact === undefined
        ? {}
        : { expectExact: check.expect_exact }),
      ...(check.expect_regex === undefined
        ? {}
        : { expectRegex: check.expect_regex }),
      ...(check.not_regex === undefined ? {} : { notRegex: check.not_regex }),
      ...(check.flags === undefined ? {} : { flags: check.flags }),
    };
    return {
      id: `darrow.shell.${index + 1}`,
      grader: "sevro.shell",
      configuration,
    };
  });
}

async function outputSchema(
  value: unknown,
  root: string,
  skillDir: string | null,
) {
  if (value === undefined) return undefined;
  if (!skillDir) throw new Error("output schema requires an owning skill");
  const source = string(value, "output schema path");
  if (isAbsolute(source) || source.split(/[\\/]/).includes(".."))
    throw new Error("output schema path is invalid");
  const skillRoot = await realpath(join(root, skillDir));
  const schemaPath = await realpath(resolve(skillRoot, source));
  if (!within(skillRoot, schemaPath))
    throw new Error("output schema escapes its owning skill");
  const bytes = await readFile(schemaPath);
  if (bytes.byteLength > 1024 * 1024)
    throw new Error("output schema exceeds the size limit");
  return record(JSON.parse(bytes.toString("utf8")), "output schema");
}

function outputConfiguration(
  check: RecordValue,
  schema: RecordValue | undefined,
) {
  return {
    ...(check.valid_json === undefined ? {} : { validJson: check.valid_json }),
    ...(schema === undefined ? {} : { schema }),
    ...(check.json_path === undefined ? {} : { jsonPath: check.json_path }),
    ...(Object.hasOwn(check, "expect_json")
      ? { expectJson: check.expect_json }
      : {}),
    ...(Object.hasOwn(check, "contains_json")
      ? { containsJson: check.contains_json }
      : {}),
    ...(check.expect_exact === undefined
      ? {}
      : { expectExact: check.expect_exact }),
    ...(check.expect_regex === undefined
      ? {}
      : { expectRegex: check.expect_regex }),
    ...(check.not_regex === undefined ? {} : { notRegex: check.not_regex }),
    ...(check.flags === undefined ? {} : { flags: check.flags }),
  };
}

async function outputCheck(
  entry: unknown,
  index: number,
  root: string,
  skillDir: string | null,
) {
  const check = record(entry, `output check ${index + 1}`);
  keys(
    check,
    [
      "name",
      "valid_json",
      "schema",
      "json_path",
      "expect_json",
      "contains_json",
      "expect_exact",
      "expect_regex",
      "not_regex",
      "flags",
      "metric",
    ],
    `output check ${index + 1}`,
  );
  string(check.name, `output check ${index + 1} name`);
  return {
    id: `darrow.output.${index + 1}`,
    grader: "sevro.output",
    configuration: outputConfiguration(
      check,
      await outputSchema(check.schema, root, skillDir),
    ),
  };
}

async function outputChecks(
  value: unknown,
  root: string,
  skillDir: string | null,
) {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new Error("case output_checks must be an array");
  return Promise.all(
    value.map((entry, index) => outputCheck(entry, index, root, skillDir)),
  );
}

function semanticOutputChecks(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new Error("case semantic_output_checks must be an array");
  return value.map((entry, index) => {
    const check = record(entry, `semantic output check ${index + 1}`);
    keys(
      check,
      ["name", "proposition", "metric"],
      `semantic output check ${index + 1}`,
    );
    string(check.name, `semantic output check ${index + 1} name`);
    return {
      id: `darrow.semantic.${index + 1}`,
      grader: "sevro.semantic",
      configuration: {
        proposition: string(
          check.proposition,
          `semantic output check ${index + 1} proposition`,
        ),
      },
    };
  });
}

function headChecks(value: unknown) {
  if (value === undefined || value === null) return [];
  if (typeof value !== "boolean")
    throw new Error("expect_head_change must be a boolean or null");
  return value
    ? [
        {
          id: "darrow.head.changed",
          grader: "sevro.git-head",
          configuration: { kind: "changed" },
        },
        {
          id: "darrow.head.lineage",
          grader: "sevro.git-head",
          configuration: { kind: "base-ancestor" },
        },
      ]
    : [
        {
          id: "darrow.head.unchanged",
          grader: "sevro.git-head",
          configuration: { kind: "unchanged" },
        },
      ];
}

function skillDirForSource(source: string): string | null {
  const parts = source.split("/");
  return parts.length === 7 &&
    parts[0] === "plugins" &&
    parts[3] === "skills" &&
    parts[5] === "evals" &&
    parts[6]?.endsWith(".yaml")
    ? parts.slice(0, 5).join("/")
    : null;
}

function checkNames(selected: RecordValue) {
  return [
    ...(selected.checks as RecordValue[]).map((check) => check.name),
    ...((selected.output_checks ?? []) as RecordValue[]).map(
      (check) => check.name,
    ),
    ...((selected.semantic_output_checks ?? []) as RecordValue[]).map(
      (check) => check.name,
    ),
  ];
}

const METRIC_LABELS = new Set([
  "escaped_defect",
  "defect_detection",
  "false_positive",
]);

function checkMetric(value: unknown, label: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !METRIC_LABELS.has(value))
    throw new Error(`${label} has an unsupported metric`);
  return value;
}

function caseCheckMetrics(selected: RecordValue) {
  const groups = [
    { field: "checks", prefix: "darrow.shell" },
    { field: "output_checks", prefix: "darrow.output" },
    { field: "semantic_output_checks", prefix: "darrow.semantic" },
  ];
  return groups.flatMap(({ field, prefix }) =>
    ((selected[field] ?? []) as unknown[]).flatMap((entry, index) => {
      const metric = checkMetric(record(entry, field).metric, field);
      return metric ? [{ checkId: `${prefix}.${index + 1}`, metric }] : [];
    }),
  );
}

function skillNames(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((name) => typeof name !== "string" || !name.trim())
  )
    throw new Error(`${label} must be a non-empty skill-name list`);
  return value as string[];
}

function caseActivationLists(selected: RecordValue) {
  const sequence = skillNames(
    selected.activation_sequence,
    "activation_sequence",
  );
  const includes = skillNames(
    selected.activation_includes,
    "activation_includes",
  );
  const excludes = skillNames(
    selected.activation_excludes,
    "activation_excludes",
  );
  return {
    ...(sequence ? { sequence } : {}),
    ...(includes ? { includes } : {}),
    ...(excludes ? { excludes } : {}),
  };
}

function validateActivationSequence(
  value: "positive" | "negative" | "competition",
  targetSkill: string,
  mountPluginSkills: boolean,
  sequence: string[] | undefined,
): void {
  if (sequence && (value === "negative" || sequence[0] !== targetSkill))
    throw new Error(
      "activation_sequence must start with a positive owning skill",
    );
  if (sequence && sequence.length > 1 && !mountPluginSkills)
    throw new Error(
      "composed activation_sequence requires sibling skill mounts",
    );
}

function validateActivationClass(
  value: unknown,
  targetSkill: string,
  mountPluginSkills: boolean,
  sequence: string[] | undefined,
): asserts value is "positive" | "negative" | "competition" {
  if (value !== "positive" && value !== "negative" && value !== "competition")
    throw new Error("case uses an unsupported activation class");
  if (value === "competition" && !mountPluginSkills)
    throw new Error("competition activation requires sibling skill mounts");
  validateActivationSequence(value, targetSkill, mountPluginSkills, sequence);
}

function caseActivation(
  selected: RecordValue,
  skillDir: string | null,
  mountPluginSkills: boolean,
) {
  const value = selected.activation;
  const lists = caseActivationLists(selected);
  if (value === undefined && Object.keys(lists).length)
    throw new Error("activation expectations require an activation class");
  if (value === undefined) return {};
  if (!skillDir)
    throw new Error("activation requires a colocated owning skill");
  const targetSkill = skillDir.split("/").at(-1)!;
  validateActivationClass(
    value,
    targetSkill,
    mountPluginSkills,
    lists.sequence,
  );
  return {
    activation: { class: value, targetSkill, ...lists },
  };
}

function caseMount(value: unknown, source: string, root: string) {
  const skillDir = skillDirForSource(source);
  if (value !== undefined && typeof value !== "boolean")
    throw new Error("mount_plugin_skills must be a boolean");
  const mountPluginSkills = value === true;
  if (mountPluginSkills && !skillDir)
    throw new Error("sibling skill mounts require a colocated owning skill");
  return {
    skillDir,
    mountPluginSkills,
    ...(skillDir
      ? {
          mount: {
            projectRoot: pathToFileURL(root).href,
            skillDir,
            mountPluginSkills,
          },
        }
      : {}),
  };
}

function additionalPluginPaths(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("additional_plugins must be a non-empty plugin-path list");
  const paths = value.map((entry) => {
    const source = string(entry, "additional plugin path");
    const parts = source.split("/");
    if (
      parts.length !== 3 ||
      parts[0] !== "plugins" ||
      !parts.slice(1).every((part) => /^[a-z][a-z0-9-]*$/.test(part))
    )
      throw new Error("additional plugin path must name a repository plugin");
    return source;
  });
  if (new Set(paths).size !== paths.length)
    throw new Error("additional_plugins contains a duplicate path");
  return paths;
}

function caseAdditionalPlugins(value: unknown, skillDir: string | null) {
  const paths = additionalPluginPaths(value);
  if (paths.length && !skillDir)
    throw new Error("additional_plugins requires a plugin-local case");
  return paths;
}

function additionalSkillPaths(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("additional_skills must be a non-empty skill-path list");
  const paths = value.map((entry) => {
    const source = string(entry, "additional skill path");
    const parts = source.split("/");
    if (
      parts.length !== 5 ||
      parts[0] !== "plugins" ||
      parts[3] !== "skills" ||
      ![parts[1], parts[2], parts[4]].every((part) =>
        /^[a-z][a-z0-9-]*$/.test(part ?? ""),
      )
    )
      throw new Error("additional skill path must name a plugin skill");
    return source;
  });
  if (new Set(paths).size !== paths.length)
    throw new Error("additional_skills contains a duplicate path");
  return paths;
}

function caseAdditionalSkills(value: unknown, skillDir: string | null) {
  const paths = additionalSkillPaths(value);
  if (paths.length && !skillDir)
    throw new Error("additional_skills requires a plugin-local case");
  return paths;
}

function caseAdditionalMounts(selected: RecordValue, skillDir: string | null) {
  const plugins = caseAdditionalPlugins(selected.additional_plugins, skillDir);
  const skills = caseAdditionalSkills(selected.additional_skills, skillDir);
  return {
    ...(plugins.length ? { additionalPlugins: plugins } : {}),
    ...(skills.length ? { additionalSkills: skills } : {}),
  };
}

function casePrompt(value: unknown, invocation: string | null) {
  const prompt = string(value, "case prompt");
  if (prompt.includes("{{skill_invocation}}") && !invocation)
    throw new Error("skill invocation requires a plugin-local case");
  if (
    prompt
      .replaceAll("{{repo_dir}}", "")
      .replaceAll("{{skill_invocation}}", "")
      .includes("{{")
  )
    throw new Error("case uses an unsupported prompt template");
  return prompt
    .replaceAll("{{repo_dir}}", "{{sevro.workspace}}")
    .replaceAll("{{skill_invocation}}", invocation ?? "");
}

async function invocationForCase(
  root: string,
  skillDir: string | null,
  prompt: string,
) {
  if (!prompt.includes("{{skill_invocation}}")) return null;
  if (!skillDir)
    throw new Error("skill invocation requires a plugin-local case");
  const pluginRoot = await realpath(join(root, dirname(dirname(skillDir))));
  if (!within(root, pluginRoot))
    throw new Error("owning plugin escapes the project root");
  const manifest = record(
    JSON.parse(
      await readFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
    ) as unknown,
    "Codex plugin manifest",
  );
  const pluginName = string(manifest.name, "Codex plugin name");
  if (!/^[a-z][a-z0-9-]*$/.test(pluginName))
    throw new Error("Codex plugin name is invalid");
  const skillName = skillDir.split("/").at(-1)!;
  return { pluginName, skillName };
}

const CASE_FIELDS = [
  "id",
  "invariant",
  "prompt",
  "follow_up_prompt",
  "harnesses",
  "fixture",
  "checks",
  "expect_head_change",
  "output_checks",
  "semantic_output_checks",
  "activation",
  "activation_sequence",
  "activation_includes",
  "activation_excludes",
  "mount_plugin_skills",
  "additional_plugins",
  "additional_skills",
  "goal_report",
  "goal_route_checks",
  "adaptive_delivery_composition",
  "transcript_checks",
];

const OWNERSHIP_CHECKS = [
  "darrow.evals.ownership.single-owner",
  "darrow.evals.ownership.parent-work",
  "darrow.evals.ownership.internal-record",
] as const;

const NO_AGENT_TRANSCRIPT_PATTERN =
  '"tool":"spawn_agent"|"type":"darrow.codex_native_spawn"|"type":"darrow.goal_agent_completion"';
const NO_AGENT_TRANSCRIPT_PATTERNS = new Set([
  NO_AGENT_TRANSCRIPT_PATTERN,
  '"tool":"spawn_agent"|"type":"darrow.codex_native_spawn"|"name":"Agent"',
  '"type":"darrow.codex_native_spawn"|"name":"Agent"',
  String.raw`"tool":"spawn_agent"|"type":"(?:darrow\.codex_native_spawn|darrow\.codex_native_single_agent_accepted|darrow\.goal_agent_completion)"`,
  String.raw`"tool":"spawn_agent"|"type":"(?:darrow\.codex_native_spawn|darrow\.codex_native_single_agent_accepted|darrow\.goal_agent_completion)"|"name":"Agent"`,
  '"tool":"spawn_agent"|"type":"darrow.codex_native_spawn"|"name":"Agent"|"name":"Task"',
]);
const NO_LEDGER_TRANSCRIPT_PATTERN =
  'adaptive-delivery-preflight step|Protocol ledger|"tool":"create_goal"';
const NO_PREFLIGHT_GOAL_PATTERN =
  'adaptive-delivery-preflight step|"tool":"create_goal"';
const NO_LEDGER_TRANSCRIPT_PATTERNS = new Set([
  NO_LEDGER_TRANSCRIPT_PATTERN,
  NO_PREFLIGHT_GOAL_PATTERN,
  "adaptive-delivery-preflight step|darrow-native-goal-report",
  "adaptive-delivery-preflight step|Protocol ledger",
]);
const ONE_OWNER_TRANSCRIPT_PATTERNS = new Set([
  '"type":"darrow.codex_native_single_agent_accepted"',
  '"type":"(?:darrow.codex_native_single_agent_accepted|darrow.goal_agent_completion)"',
  String.raw`"type":"(?:darrow\.codex_native_single_agent_accepted|darrow\.goal_agent_completion)"`,
]);
const CONTINUATION_BOUNDARY_PATTERNS = new Set([
  String.raw`"type":"darrow\.eval\.follow_up_turn"`,
  '"type":"darrow.eval.follow_up_turn","thread_id":"[^"]+"',
]);
const CONTINUATION_UNCHANGED_PATTERNS = new Set([
  String.raw`"type":"darrow.eval.follow_up_turn"[^\n]*"pre_feedback_worktree_unchanged":true`,
]);
const CONTINUATION_CHANGED_PATTERN = String.raw`"type":"darrow\.eval\.follow_up_turn"(?![^\n]*"pre_feedback_worktree_unchanged":true)[^\n]*[\s\S]*"type":"darrow\.codex_native_`;
const OWNER_AFTER_CONTINUATION_PATTERN = String.raw`"type":"darrow.eval.follow_up_turn"[\s\S]*"type":"(?:darrow\.codex_native_single_agent_accepted|darrow\.goal_agent_completion)"`;
const NO_OWNER_BEFORE_CONTINUATION_PATTERN = String.raw`"type":"(?:darrow\.codex_native_single_agent_accepted|darrow\.goal_agent_completion)"[\s\S]*"type":"darrow.eval.follow_up_turn"`;
const NO_NATIVE_GOAL_CONTROL_PATTERN = String.raw`"type":"darrow\.codex_native_goal_control"[^\n]*"tool":"(?:create_goal|update_goal)"`;
const SPECIAL_NEGATIVE_TRANSCRIPT_KINDS = new Map([
  [CONTINUATION_CHANGED_PATTERN, "unchanged-before-continuation"],
  [NO_OWNER_BEFORE_CONTINUATION_PATTERN, "no-owner-before-continuation"],
  [NO_NATIVE_GOAL_CONTROL_PATTERN, "no-native-goal-control"],
]);

function expectedTranscriptKind(pattern: unknown): string | null {
  if (ONE_OWNER_TRANSCRIPT_PATTERNS.has(pattern as string))
    return "one-owner-accepted";
  if (CONTINUATION_BOUNDARY_PATTERNS.has(pattern as string))
    return "continuation-boundary";
  if (CONTINUATION_UNCHANGED_PATTERNS.has(pattern as string))
    return "unchanged-before-continuation";
  if (pattern === OWNER_AFTER_CONTINUATION_PATTERN)
    return "owner-after-continuation";
  return null;
}

function caseTranscriptCheck(entry: unknown, index: number) {
  const check = record(entry, `transcript check ${index + 1}`);
  keys(
    check,
    ["name", "not_regex", "expect_regex"],
    `transcript check ${index + 1}`,
  );
  const name = string(check.name, `transcript check ${index + 1} name`);
  const id = `darrow.evals.transcript.${index + 1}`;
  if (check.expect_regex !== undefined) {
    const kind = expectedTranscriptKind(check.expect_regex);
    if (kind && check.not_regex === undefined) return { id, name, kind };
    throw new Error(
      `transcript check ${index + 1} has no Sevro evidence mapping`,
    );
  }
  const specialKind = SPECIAL_NEGATIVE_TRANSCRIPT_KINDS.get(
    check.not_regex as string,
  );
  if (specialKind) return { id, name, kind: specialKind };
  const noAgent = NO_AGENT_TRANSCRIPT_PATTERNS.has(check.not_regex as string);
  if (!noAgent && !NO_LEDGER_TRANSCRIPT_PATTERNS.has(check.not_regex as string))
    throw new Error(
      `transcript check ${index + 1} has no Sevro evidence mapping`,
    );
  return {
    id,
    name,
    kind: noAgent ? "no-agent-spawn" : "no-lifecycle-ledger",
    ...(noAgent
      ? {}
      : {
          terms: (check.not_regex as string).split("|"),
          forbidGoal: (check.not_regex as string).includes(
            '"tool":"create_goal"',
          ),
        }),
  };
}

function caseTranscriptChecks(value: unknown) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || !value.length)
    throw new Error("transcript_checks must be a nonempty list");
  return value.map(caseTranscriptCheck);
}

function ignoredGoalPolicy(selected: RecordValue, skillDir: string | null) {
  return (
    !skillDir?.endsWith("/adaptive-delivery") &&
    selected.goal_report === "forbidden" &&
    (selected.goal_route_checks === undefined ||
      selected.goal_route_checks === false)
  );
}

function caseHostIds(value: unknown): string[] | null {
  if (value === undefined) return null;
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((name) => name !== "codex" && name !== "claude") ||
    new Set(value).size !== value.length
  )
    throw new Error("case harnesses must be unique supported host names");
  return value.map((name) => `sevro.host.${name}`);
}

function compositionOwnership(selected: RecordValue) {
  if (
    selected.adaptive_delivery_composition !== undefined &&
    typeof selected.adaptive_delivery_composition !== "boolean"
  )
    throw new Error("adaptive delivery composition must be a boolean");
  if (selected.adaptive_delivery_composition !== true) return null;
  if (
    selected.goal_report !== undefined ||
    selected.goal_route_checks !== undefined
  )
    throw new Error("composition and goal policies cannot be combined");
  return {
    mode: "composition" as const,
    checks: OWNERSHIP_CHECKS.slice(0, 2).map((id) => ({
      id,
      grader: "darrow.evals.ownership",
      configuration: {},
    })),
    requiredEvidence: ["sevro.codex.native-calls"],
  };
}

function caseOwnership(selected: RecordValue, skillDir: string | null) {
  const composition = compositionOwnership(selected);
  if (composition) return composition;
  if (
    selected.goal_report === undefined &&
    selected.goal_route_checks === undefined
  )
    return null;
  if (ignoredGoalPolicy(selected, skillDir)) return null;
  if (
    !skillDir?.endsWith("/adaptive-delivery") ||
    selected.goal_route_checks !== false ||
    (selected.goal_report !== undefined && selected.goal_report !== "forbidden")
  )
    throw new Error("case goal policy is unsupported by the Sevro extension");
  return {
    mode: "owner" as const,
    checks: OWNERSHIP_CHECKS.map((id) => ({
      id,
      grader: "darrow.evals.ownership",
      configuration: {},
    })),
    requiredEvidence: ["sevro.codex.native-calls"],
  };
}

function policyEvidence(
  ownership: ReturnType<typeof caseOwnership>,
  transcriptChecks: ReturnType<typeof caseTranscriptChecks>,
) {
  return [
    ...(ownership ||
    transcriptChecks?.some((check) =>
      [
        "no-agent-spawn",
        "one-owner-accepted",
        "no-lifecycle-ledger",
        "owner-after-continuation",
        "no-owner-before-continuation",
        "no-native-goal-control",
      ].includes(check.kind),
    )
      ? ["sevro.codex.native-calls"]
      : []),
    ...(transcriptChecks?.some((check) => check.kind === "no-lifecycle-ledger")
      ? ["sevro.codex.events"]
      : []),
  ];
}

function casePolicy(selected: RecordValue, skillDir: string | null) {
  const ownership = caseOwnership(selected, skillDir);
  const transcriptChecks = caseTranscriptChecks(selected.transcript_checks);
  return {
    checks: [
      ...(ownership?.checks ?? []),
      ...(transcriptChecks?.map(({ id }) => ({
        id,
        grader: "darrow.evals.transcript",
        configuration: {},
      })) ?? []),
    ],
    requiredEvidence: policyEvidence(ownership, transcriptChecks),
    details: {
      ...(ownership
        ? { ownership: ownership.mode === "owner" ? true : "composition" }
        : {}),
      ...(transcriptChecks ? { transcriptChecks } : {}),
    },
  };
}

async function caseChecks(
  selected: RecordValue,
  root: string,
  skillDir: string | null,
) {
  return [
    ...shellChecks(selected.checks),
    ...headChecks(selected.expect_head_change),
    ...(await outputChecks(selected.output_checks, root, skillDir)),
    ...semanticOutputChecks(selected.semantic_output_checks),
  ];
}

async function casePrompts(
  selected: RecordValue,
  root: string,
  skillDir: string | null,
) {
  const invocation = await invocationForCase(
    root,
    skillDir,
    `${string(selected.prompt, "case prompt")}\n${selected.follow_up_prompt ?? ""}`,
  );
  const token = invocation ? "{{sevro.codex.skill_invocation}}" : null;
  return {
    invocation,
    prompt: casePrompt(selected.prompt, token),
    ...(selected.follow_up_prompt === undefined
      ? {}
      : { followUpPrompt: casePrompt(selected.follow_up_prompt, token) }),
  };
}

async function neutralCase(value: unknown, source: string, root: string) {
  const selected = record(value, "case");
  keys(selected, CASE_FIELDS, "case");
  const id = string(selected.id, "case ID");
  const invariant = string(selected.invariant, "case invariant");
  const hostIds = caseHostIds(selected.harnesses);
  const { fixture, ...setup } = caseFixture(selected.fixture);
  const { skillDir, mountPluginSkills, ...mount } = caseMount(
    selected.mount_plugin_skills,
    source,
    root,
  );
  const additionalMounts = caseAdditionalMounts(selected, skillDir);
  const { invocation, prompt, ...followUp } = await casePrompts(
    selected,
    root,
    skillDir,
  );
  const policy = casePolicy(selected, skillDir);
  const checks = [
    ...(await caseChecks(selected, root, skillDir)),
    ...policy.checks,
  ];
  const checkMetrics = caseCheckMetrics(selected);
  return {
    id,
    prompt,
    ...followUp,
    fixture,
    checks,
    requiredEvidence: policy.requiredEvidence,
    extensionData: {
      "darrow.case": {
        invariant,
        ...(hostIds ? { hostIds } : {}),
        source,
        projectRoot: pathToFileURL(root).href,
        ...setup,
        ...mount,
        ...additionalMounts,
        ...(invocation ? { invocation } : {}),
        ...policy.details,
        ...caseActivation(selected, skillDir, mountPluginSkills),
        checkNames: checkNames(selected),
        ...(checkMetrics.length ? { checkMetrics } : {}),
      },
    },
  };
}

const OMITTED_SKILL_ENTRIES = new Set([
  ".coverage",
  ".hypothesis",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".venv",
  "__pycache__",
  "coverage.json",
  "evals",
]);

interface SkillArtifact {
  id: string;
  relativePath: string;
  sha256: string;
  contentBase64: string;
  gitExclude: true;
  executable?: true;
}

function portableName(name: string): boolean {
  return (
    name !== "." &&
    name !== ".." &&
    !name.includes(":") &&
    !name.includes("\\") &&
    ![...name].some((character) => {
      const code = character.codePointAt(0)!;
      return code < 32 || code === 127;
    })
  );
}

async function siblingSkillSources(root: string, skillRoot: string) {
  const siblings = await readdir(join(skillRoot, ".."), {
    withFileTypes: true,
  });
  const sources: { skillRoot: string; skillName: string }[] = [];
  for (const entry of siblings.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  )) {
    if (entry.isSymbolicLink())
      throw new Error("sibling skill mount contains a symbolic link");
    if (!entry.isDirectory()) continue;
    if (!portableName(entry.name))
      throw new Error("sibling skill name is not a portable fixture path");
    const siblingRoot = await realpath(join(skillRoot, "..", entry.name));
    if (!within(root, siblingRoot))
      throw new Error("sibling skill mount escapes the project root");
    sources.push({ skillRoot: siblingRoot, skillName: entry.name });
  }
  return sources;
}

async function skillMountSource(details: RecordValue) {
  const mount = record(details.mount, "skill mount");
  const rootUrl = string(mount.projectRoot, "mount project root");
  if (!rootUrl.startsWith("file:///"))
    throw new Error("mount project root must be a file URL");
  const root = await realpath(fileURLToPath(rootUrl));
  const skillDir = string(mount.skillDir, "mount skill directory");
  if (skillDir !== skillDirForSource(string(details.source, "case source")))
    throw new Error("skill mount does not match the selected case");
  const skillRoot = await realpath(join(root, skillDir));
  if (!within(root, skillRoot) || !(await stat(skillRoot)).isDirectory())
    throw new Error("skill mount escapes the project root");
  const skillName = skillDir.split("/").at(-1)!;
  if (!portableName(skillName))
    throw new Error("skill name is not a portable fixture path");
  if (typeof mount.mountPluginSkills !== "boolean")
    throw new Error("skill mount must declare sibling selection");
  if (!mount.mountPluginSkills) return [{ skillRoot, skillName }];
  return siblingSkillSources(root, skillRoot);
}

async function pluginName(pluginRoot: string): Promise<string> {
  const manifest = record(
    JSON.parse(
      await readFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
    ) as unknown,
    "Codex plugin manifest",
  );
  const name = string(manifest.name, "Codex plugin name");
  if (!/^[a-z][a-z0-9-]*$/.test(name))
    throw new Error("Codex plugin name is invalid");
  return name;
}

async function pluginSkillSources(pluginRoot: string) {
  const skillsRoot = join(pluginRoot, "skills");
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const sources = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (entry.isSymbolicLink())
      throw new Error("additional plugin skill is a symbolic link");
    if (!entry.isDirectory()) continue;
    if (!portableName(entry.name))
      throw new Error("additional plugin skill name is invalid");
    const skillRoot = await realpath(join(skillsRoot, entry.name));
    if (!within(pluginRoot, skillRoot))
      throw new Error("additional plugin skill escapes its source");
    sources.push({ skillRoot, skillName: entry.name });
  }
  if (!sources.length) throw new Error("additional plugin has no skills");
  return sources;
}

async function additionalPluginSource(
  root: string,
  owner: string,
  source: string,
) {
  if (source === owner)
    throw new Error("additional plugin duplicates the owning plugin");
  const sourcePath = join(root, source);
  if ((await lstat(sourcePath)).isSymbolicLink())
    throw new Error("additional plugin is a symbolic link");
  const pluginRoot = await realpath(sourcePath);
  if (!within(root, pluginRoot) || !(await stat(pluginRoot)).isDirectory())
    throw new Error("additional plugin escapes the project root");
  return {
    pluginRoot,
    name: await pluginName(pluginRoot),
    sources: await pluginSkillSources(pluginRoot),
  };
}

async function additionalPluginSources(details: RecordValue) {
  const paths = additionalPluginPaths(details.additionalPlugins);
  if (!paths.length) return [];
  const root = await realpath(
    fileURLToPath(string(details.projectRoot, "case project root")),
  );
  const owner = dirname(
    dirname(
      string(record(details.mount, "skill mount").skillDir, "skill directory"),
    ),
  );
  return Promise.all(
    paths.map((source) => additionalPluginSource(root, owner, source)),
  );
}

async function selectedSkillSource(root: string, source: string) {
  const pluginPath = source.split("/").slice(0, 3).join("/");
  const pluginSource = join(root, pluginPath);
  const skillSource = join(root, source);
  if (
    (await lstat(pluginSource)).isSymbolicLink() ||
    (await lstat(skillSource)).isSymbolicLink()
  )
    throw new Error("additional skill source is a symbolic link");
  const pluginRoot = await realpath(pluginSource);
  const skillRoot = await realpath(skillSource);
  if (
    !within(root, pluginRoot) ||
    !within(pluginRoot, skillRoot) ||
    !(await stat(skillRoot)).isDirectory()
  )
    throw new Error("additional skill escapes its source plugin");
  return {
    pluginRoot,
    name: await pluginName(pluginRoot),
    source: { skillRoot, skillName: source.split("/").at(-1)! },
  };
}

async function additionalSkillSources(details: RecordValue) {
  const paths = additionalSkillPaths(details.additionalSkills);
  if (!paths.length) return [];
  const root = await realpath(
    fileURLToPath(string(details.projectRoot, "case project root")),
  );
  const selected = await Promise.all(
    paths.map((source) => selectedSkillSource(root, source)),
  );
  const packages = new Map<
    string,
    {
      pluginRoot: string;
      name: string;
      sources: { skillRoot: string; skillName: string }[];
    }
  >();
  for (const item of selected) {
    const existing = packages.get(item.pluginRoot);
    if (existing) existing.sources.push(item.source);
    else
      packages.set(item.pluginRoot, {
        pluginRoot: item.pluginRoot,
        name: item.name,
        sources: [item.source],
      });
  }
  return [...packages.values()];
}

function mergeAdditionalSkills(
  ownerSources: { skillRoot: string; skillName: string }[],
  fullPlugins: Awaited<ReturnType<typeof additionalPluginSources>>,
  selectedPlugins: Awaited<ReturnType<typeof additionalSkillSources>>,
) {
  const owner = [...ownerSources];
  const additional = fullPlugins.map((item) => ({
    ...item,
    sources: [...item.sources],
  }));
  const ownerRoot = ownerSources[0]
    ? dirname(dirname(ownerSources[0].skillRoot))
    : null;
  for (const item of selectedPlugins) {
    const target =
      item.pluginRoot === ownerRoot
        ? owner
        : additional.find((entry) => entry.pluginRoot === item.pluginRoot)
            ?.sources;
    if (target) {
      for (const source of item.sources)
        if (!target.some((entry) => entry.skillRoot === source.skillRoot))
          target.push(source);
    } else additional.push(item);
  }
  return { owner, additional };
}

function skillArtifact(
  bytes: Buffer,
  relativePath: string,
  index: number,
  executable: boolean,
): SkillArtifact {
  return {
    id: `darrow.skill.${index}`,
    relativePath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    contentBase64: bytes.toString("base64"),
    gitExclude: true,
    ...(executable ? { executable: true } : {}),
  };
}

function checkSkillArtifactLimit(bytes: Buffer, total: number, count: number) {
  if (bytes.byteLength > 1024 * 1024 || total > 4 * 1024 * 1024 || count >= 256)
    throw new Error("skill mount exceeds the artifact limit");
}

function hasMountedSkill(
  artifacts: SkillArtifact[],
  destination: string,
  skillName: string,
): boolean {
  return artifacts.some(
    (artifact) =>
      artifact.relativePath === `${destination}/${skillName}/SKILL.md`,
  );
}

async function skillArtifacts(
  sources: { skillRoot: string; skillName: string }[],
  destination = ".agents/skills",
  artifacts: SkillArtifact[] = [],
) {
  let totalBytes = artifacts.reduce(
    (size, artifact) =>
      size + Buffer.from(artifact.contentBase64, "base64").byteLength,
    0,
  );
  async function collect(
    skillRoot: string,
    skillName: string,
    directory: string,
    parts: string[],
  ): Promise<void> {
    const entries = (await readdir(directory, { withFileTypes: true })).sort(
      (left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      if (OMITTED_SKILL_ENTRIES.has(entry.name)) continue;
      if (!portableName(entry.name) || entry.isSymbolicLink())
        throw new Error("skill mount contains an unsafe entry");
      const next = [...parts, entry.name];
      const path = join(directory, entry.name);
      if (!within(skillRoot, await realpath(path)))
        throw new Error("skill mount escapes its source directory");
      if (entry.isDirectory()) {
        await collect(skillRoot, skillName, path, next);
        continue;
      }
      if (!entry.isFile()) throw new Error("skill mount contains a non-file");
      const bytes = await readFile(path);
      const executable = ((await stat(path)).mode & 0o111) !== 0;
      totalBytes += bytes.byteLength;
      checkSkillArtifactLimit(bytes, totalBytes, artifacts.length);
      const relativePath = [destination, skillName, ...next].join("/");
      artifacts.push(
        skillArtifact(bytes, relativePath, artifacts.length + 1, executable),
      );
    }
  }
  for (const { skillRoot, skillName } of sources) {
    await collect(skillRoot, skillName, skillRoot, []);
    if (!hasMountedSkill(artifacts, destination, skillName))
      throw new Error("selected skill has no SKILL.md");
  }
  return artifacts;
}

const MARKETPLACE_ROOT = ".sevro-marketplace";

async function optionalPluginDirectory(path: string): Promise<boolean> {
  try {
    const entry = await lstat(path);
    if (!entry.isDirectory() || entry.isSymbolicLink())
      throw new Error("plugin package source is not a directory");
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return false;
    throw error;
  }
}

async function collectPluginDirectory(
  pluginRoot: string,
  directory: string,
  parts: string[],
  state: {
    artifacts: SkillArtifact[];
    total: { bytes: number };
    destination: string;
  },
): Promise<void> {
  const { artifacts, total, destination } = state;
  const entries = (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  );
  for (const entry of entries) {
    if (OMITTED_SKILL_ENTRIES.has(entry.name)) continue;
    if (!portableName(entry.name) || entry.isSymbolicLink())
      throw new Error("plugin package contains an unsafe entry");
    const next = [...parts, entry.name];
    const path = join(directory, entry.name);
    if (!within(pluginRoot, await realpath(path)))
      throw new Error("plugin package escapes its source directory");
    if (entry.isDirectory()) {
      await collectPluginDirectory(pluginRoot, path, next, state);
      continue;
    }
    if (!entry.isFile()) throw new Error("plugin package contains a non-file");
    const bytes = await readFile(path);
    total.bytes += bytes.byteLength;
    checkSkillArtifactLimit(bytes, total.bytes, artifacts.length);
    artifacts.push(
      skillArtifact(
        bytes,
        [destination, ...next].join("/"),
        artifacts.length + 1,
        ((await stat(path)).mode & 0o111) !== 0,
      ),
    );
  }
}

async function appendPluginMechanics(
  pluginRoot: string,
  destination: string,
  artifacts: SkillArtifact[],
  total: { bytes: number },
): Promise<void> {
  for (const name of [
    ".claude-plugin",
    ".codex-plugin",
    "agents",
    "bin",
    "config",
    "hooks",
    "backend",
  ]) {
    const directory = join(pluginRoot, name);
    if (await optionalPluginDirectory(directory))
      await collectPluginDirectory(pluginRoot, directory, [name], {
        artifacts,
        total,
        destination,
      });
  }
  if (
    !artifacts.some(
      (artifact) =>
        artifact.relativePath === `${destination}/.claude-plugin/plugin.json`,
    ) ||
    !artifacts.some(
      (artifact) =>
        artifact.relativePath === `${destination}/.codex-plugin/plugin.json`,
    )
  )
    throw new Error("Codex plugin package needs both manifests");
}

function appendMarketplaceManifest(
  artifacts: SkillArtifact[],
  total: { bytes: number },
  plugins: { name: string; source: string }[],
): void {
  const marketplace = Buffer.from(
    JSON.stringify({
      name: "darrow-eval",
      owner: { name: "Darrow eval" },
      plugins: plugins.map(({ name, source }) => ({
        name,
        source,
        description: "Filtered source plugin for evaluation",
      })),
    }) + "\n",
  );
  total.bytes += marketplace.byteLength;
  checkSkillArtifactLimit(marketplace, total.bytes, artifacts.length);
  artifacts.push(
    skillArtifact(
      marketplace,
      `${MARKETPLACE_ROOT}/.claude-plugin/marketplace.json`,
      artifacts.length + 1,
      false,
    ),
  );
}

async function codexPluginArtifacts(
  sources: { skillRoot: string; skillName: string }[],
  ownerName: string,
  additional: Awaited<ReturnType<typeof additionalPluginSources>> = [],
): Promise<SkillArtifact[]> {
  const pluginRoot = dirname(dirname(sources[0]!.skillRoot));
  if (
    sources.some((source) => dirname(dirname(source.skillRoot)) !== pluginRoot)
  )
    throw new Error("plugin package mixes source roots");
  if ((await pluginName(pluginRoot)) !== ownerName)
    throw new Error("Codex plugin name changed after resolution");
  const packages = [
    { pluginRoot, name: ownerName, sources, destination: "plugin" },
    ...additional.map((item, index) => ({
      ...item,
      destination: `plugins/${index}-${item.name}`,
    })),
  ];
  if (new Set(packages.map((item) => item.name)).size !== packages.length)
    throw new Error("Codex marketplace plugin names must be unique");
  const artifacts: SkillArtifact[] = [];
  const total = { bytes: 0 };
  for (const item of packages) {
    const destination = `${MARKETPLACE_ROOT}/${item.destination}`;
    await skillArtifacts(item.sources, `${destination}/skills`, artifacts);
    total.bytes = artifacts.reduce(
      (size, artifact) =>
        size + Buffer.from(artifact.contentBase64, "base64").byteLength,
      0,
    );
    await appendPluginMechanics(item.pluginRoot, destination, artifacts, total);
  }
  appendMarketplaceManifest(
    artifacts,
    total,
    packages.map(({ name, destination }) => ({
      name,
      source: `./${destination}`,
    })),
  );
  return artifacts;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function ticketProvision(
  ticket: NonNullable<ReturnType<typeof fixtureTicket>>,
) {
  return `(
set -e
mkdir -p .git/fixture-bin .git/fixture-state
printf '%s\\n' ${shellQuote(ticket.id)} > .git/fixture-ticket-id
printf '%s\\n' ${shellQuote(ticket.title)} > .git/fixture-ticket-title
printf '%s' ${shellQuote(ticket.body)} > .git/fixture-ticket.md
: > .git/fixture-state/ticketctl.log
ln -s fixture-state/ticketctl.log .git/ticketctl.log
) || exit $?`;
}

async function readBoundCase(details: RecordValue, caseId: string) {
  const rootUrl = string(details.projectRoot, "case project root");
  if (!rootUrl.startsWith("file:///"))
    throw new Error("case project root must be a file URL");
  const root = await realpath(fileURLToPath(rootUrl));
  const source = string(details.source, "case source");
  if (
    isAbsolute(source) ||
    source.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error("case source path is invalid");
  const path = await realpath(join(root, source));
  if (!within(root, path))
    throw new Error("case source escapes the project root");
  const selected = record(parseYaml(await readFile(path, "utf8")), "case");
  if (selected.id !== caseId)
    throw new Error("case source changed after resolution");
  return { fixture: record(selected.fixture, "fixture"), source };
}

function verifyFixturePreparation(details: RecordValue, fixture: RecordValue) {
  const script = fixtureSetupScript(fixture);
  const ticket = fixtureTicket(fixture);
  const setupDigest = script
    ? createHash("sha256").update(script).digest("hex")
    : null;
  const ticketDigest = ticket
    ? createHash("sha256").update(JSON.stringify(ticket)).digest("hex")
    : null;
  if (setupDigest !== (details.setupDigest ?? null))
    throw new Error("fixture setup changed after resolution");
  if (ticketDigest !== (details.ticketDigest ?? null))
    throw new Error("fixture ticket changed after resolution");
  return { script, ticket };
}

async function caseSetup(details: RecordValue, caseId: string) {
  if (details.setupDigest === undefined && details.ticketDigest === undefined)
    return null;
  const { fixture, source } = await readBoundCase(details, caseId);
  const { script, ticket } = verifyFixturePreparation(details, fixture);
  return {
    command: [
      "/bin/bash",
      "-c",
      [
        ...(ticket ? [ticketProvision(ticket)] : []),
        ...(script
          ? [script.replaceAll("{{case_dir}}", "$DARROW_EVAL_CASE_DIR")]
          : []),
      ].join("\n"),
    ],
    environment: script
      ? {
          DARROW_EVAL_CASE_DIR: `{{sevro.project}}/${dirname(source).split(sep).join("/")}`,
        }
      : {},
  };
}

function requireActivationSkills(
  details: RecordValue,
  sources: { skillRoot: string; skillName: string }[],
): void {
  if (details.activation === undefined) return;
  const expected = activationExpectation(details.activation);
  for (const skill of [
    expected.targetSkill,
    ...(expected.sequence ?? []),
    ...(expected.includes ?? []),
    ...(expected.excludes ?? []),
  ]) {
    if (!sources.some((source) => source.skillName === skill))
      throw new Error(
        `activation skill ${skill} is absent from the mounted set`,
      );
  }
}

function requiredInvocation(
  details: RecordValue,
  sources: { skillRoot: string; skillName: string }[],
  hostValue: unknown,
): { pluginName: string; skillName: string } | null {
  const invocation =
    details.invocation === undefined
      ? null
      : record(details.invocation, "skill invocation");
  if (!invocation) return null;
  const host = record(hostValue, "candidate host");
  if (
    host.id !== "sevro.host.codex" ||
    !Array.isArray(host.capabilities) ||
    !host.capabilities.includes("sevro.codex.plugin-marketplace") ||
    !host.capabilities.includes("sevro.codex.explicit-invocation")
  )
    throw new Error("skill invocation requires the Codex plugin host");
  if (!sources.some((source) => source.skillName === invocation.skillName))
    throw new Error("invoked skill is absent from the package");
  return {
    pluginName: string(invocation.pluginName, "Codex plugin name"),
    skillName: string(invocation.skillName, "invoked skill name"),
  };
}

function codexPackageHost(
  hostValue: unknown,
  hasAdditional: boolean,
  hasInvocation: boolean,
): boolean {
  const host = record(hostValue, "candidate host");
  const selected =
    hasInvocation || (host.id === "sevro.host.codex" && hasAdditional);
  if (
    selected &&
    (!Array.isArray(host.capabilities) ||
      !host.capabilities.includes("sevro.codex.plugin-marketplace"))
  )
    throw new Error("additional plugins require the Codex plugin host");
  return selected;
}

async function preparedMounts(details: RecordValue, hostValue: unknown) {
  const sources =
    details.mount === undefined ? [] : await skillMountSource(details);
  const { owner, additional } = mergeAdditionalSkills(
    sources,
    await additionalPluginSources(details),
    await additionalSkillSources(details),
  );
  const mounted = [...owner, ...additional.flatMap((item) => item.sources)];
  if (new Set(mounted.map((item) => item.skillName)).size !== mounted.length)
    throw new Error("mounted skill names must be unique");
  requireActivationSkills(details, mounted);
  const invocation = requiredInvocation(details, mounted, hostValue);
  const packagePlugins = codexPackageHost(
    hostValue,
    additional.length > 0,
    invocation !== null,
  );
  const ownerName = packagePlugins
    ? (invocation?.pluginName ??
      (await pluginName(dirname(dirname(owner[0]!.skillRoot)))))
    : null;
  const artifacts = packagePlugins
    ? await codexPluginArtifacts(owner, ownerName!, additional)
    : await skillArtifacts(mounted);
  return {
    artifacts,
    ...(packagePlugins
      ? {
          codexMarketplace: {
            artifactRoot: MARKETPLACE_ROOT,
            marketplaceName: "darrow-eval",
            pluginNames: [ownerName!, ...additional.map((item) => item.name)],
          },
          ...(invocation ? { codexSkillInvocation: invocation } : {}),
        }
      : {}),
  };
}

function withoutSkill(configuration: unknown): boolean {
  const selected = record(configuration ?? {}, "extension configuration");
  const extra = Object.keys(selected).filter((key) => key !== "withoutSkill");
  if (extra.length)
    throw new Error(`unsupported extension configuration: ${extra.join(", ")}`);
  if (selected.withoutSkill !== undefined && selected.withoutSkill !== true)
    throw new Error("withoutSkill configuration must be true");
  return selected.withoutSkill === true;
}

function requireCaseHost(hostIds: unknown, hostValue: unknown): void {
  if (hostIds === undefined) return;
  const host = record(hostValue, "candidate host");
  if (
    !Array.isArray(hostIds) ||
    !hostIds.length ||
    hostIds.some((id) => typeof id !== "string") ||
    !hostIds.includes(host.id)
  )
    throw new Error("selected case excludes the candidate host");
}

async function prepareCase(params: RecordValue) {
  const selected = record(params.case, "prepared case");
  const data = record(selected.extensionData, "case extension data");
  const details = record(data["darrow.case"], "Darrow case data");
  requireCaseHost(details.hostIds, params.host);
  const omitSkills = withoutSkill(params.configuration);
  if (omitSkills && details.invocation !== undefined)
    throw new Error("explicit skill invocation cannot run without skills");
  if (
    details.ownership !== undefined ||
    details.transcriptChecks !== undefined
  ) {
    const host = record(params.host, "candidate host");
    if (
      host.id !== "sevro.host.codex" ||
      !Array.isArray(host.capabilities) ||
      !host.capabilities.includes("sevro.codex.native-calls")
    )
      throw new Error("native checks require Codex native-call evidence");
  }
  const setup = await caseSetup(details, string(selected.id, "case ID"));
  return {
    ...(omitSkills
      ? { artifacts: [] }
      : await preparedMounts(details, params.host)),
    requestedInstrumentation: [],
    ...(setup ? { fixtureSetup: setup } : {}),
    extensionData: {},
  };
}

function within(root: string, path: string): boolean {
  const child = relative(root, path);
  return child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

async function caseEntries(root: string) {
  const entries: { value: unknown; source: string }[] = [];
  for (const pattern of [
    "evals/experiments/*/cases/*.yaml",
    "plugins/*/*/skills/*/evals/*.yaml",
  ]) {
    const glob = new Bun.Glob(pattern);
    for await (const source of glob.scan({ cwd: root })) {
      const path = await realpath(join(root, source));
      if (!within(root, path))
        throw new Error("case path escapes the project root");
      const value = parseYaml(await readFile(path, "utf8")) as unknown;
      entries.push({ value, source });
    }
  }
  return entries;
}

/** Resolve suite filters to exact IDs before starting any public CLI runs. */
export async function selectCaseIds(root: string, filters: string[]) {
  if (!filters.length || filters.some((filter) => !filter.trim()))
    throw new Error("suite needs nonempty case filters");
  const projectRoot = await realpath(root);
  const ids = new Set<string>();
  const selected = new Set<string>();
  for (const entry of await caseEntries(projectRoot)) {
    const id = string(record(entry.value, "case").id, "case ID");
    if (ids.has(id)) throw new Error(`duplicate case ID: ${id}`);
    ids.add(id);
    if (filters.some((filter) => id.includes(filter))) selected.add(id);
  }
  if (!selected.size) throw new Error("No cases matched.");
  return [...selected].sort();
}

/** Inventory every Darrow case against the current extension before a switch. */
export async function auditCaseCompatibility(root: string) {
  const projectRoot = await realpath(root);
  const entries = await caseEntries(projectRoot);
  if (!entries.length) throw new Error("No cases found.");
  const seen = new Set<string>();
  const failures: { id: string | null; source: string; error: string }[] = [];
  let supported = 0;
  for (const entry of entries) {
    let id: string | null = null;
    try {
      id = string(record(entry.value, "case").id, "case ID");
      if (seen.has(id)) throw new Error(`duplicate case ID: ${id}`);
      seen.add(id);
      await neutralCase(entry.value, entry.source, projectRoot);
      supported++;
    } catch (error) {
      failures.push({
        id,
        source: join(projectRoot, entry.source),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    format: "darrow-sevro-compatibility-v1",
    projectRoot,
    total: entries.length,
    supported,
    failures: failures.sort((left, right) =>
      left.source.localeCompare(right.source),
    ),
    valid: failures.length === 0,
  };
}

export async function resolveCase(params: RecordValue) {
  const url = string(params.projectRoot, "project root");
  if (!url.startsWith("file:///"))
    throw new Error("project root must be a file URL");
  const root = await realpath(fileURLToPath(url));
  const selectors = record(params.selectors, "selectors");
  if (!Array.isArray(selectors.caseIds) || selectors.caseIds.length !== 1)
    throw new Error("resolve needs exactly one case ID");
  const target = string(selectors.caseIds[0], "selected case ID");
  const matches = (await caseEntries(root)).filter(
    ({ value }) => record(value, "case").id === target,
  );
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? "selected case ID is ambiguous"
        : "selected case ID was not found",
    );
  return {
    cases: [await neutralCase(matches[0]!.value, matches[0]!.source, root)],
  };
}

function activationExpectation(value: unknown) {
  const activation = record(value, "activation expectation");
  const activationClass = string(activation.class, "activation class");
  const targetSkill = string(activation.targetSkill, "activation target skill");
  if (
    activationClass !== "positive" &&
    activationClass !== "negative" &&
    activationClass !== "competition"
  )
    throw new Error("unsupported activation expectation");
  return {
    activationClass,
    targetSkill,
    sequence: skillNames(activation.sequence, "activation sequence"),
    includes: skillNames(activation.includes, "activation inclusion"),
    excludes: skillNames(activation.excludes, "activation exclusion"),
  };
}

function activationObservation(
  value: unknown,
  explicit: boolean,
): RecordValue | null {
  if (!Array.isArray(value))
    throw new Error("evaluation observations must be an array");
  const matches = value.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      (explicit
        ? item.id === "sevro.codex.explicit-invocation"
        : item.id === "darrow.activation" ||
          item.id === "sevro.codex.skill-reads"),
  );
  return matches.length === 1
    ? record(matches[0], "activation observation")
    : null;
}

function activationData(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function skillSequence(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((skill) => typeof skill === "string" && skill.length))
    return null;
  return value as string[];
}

function supportedActivationSource(
  observation: RecordValue,
  data: RecordValue,
  explicit: boolean,
): boolean {
  if (explicit)
    return (
      observation.id === "sevro.codex.explicit-invocation" &&
      observation.source === "sevro.host.codex" &&
      data.method === "explicit_invocation"
    );
  if (observation.id === "darrow.activation") return true;
  return (
    observation.id === "sevro.codex.skill-reads" &&
    observation.source === "sevro.host.codex" &&
    data.method === "skill_file_read_probe"
  );
}

function observedActivation(
  observation: RecordValue | null,
  explicit: boolean,
) {
  if (observation?.completeness !== "complete") return null;
  const data = activationData(observation.data);
  if (!data) return null;
  if (!supportedActivationSource(observation, data, explicit)) return null;
  const observedSkills = skillSequence(data.observedSkills);
  if (!observedSkills) return null;
  const primarySkill = data.primarySkill;
  if (primarySkill !== null && !nonemptyString(primarySkill)) return null;
  if (primarySkill !== (observedSkills[0] ?? null)) return null;
  return { primarySkill, observedSkills };
}

function nonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function matchesSkillExpectations(
  expected: ReturnType<typeof activationExpectation>,
  observedSkills: string[],
) {
  const sequencePassed =
    expected.sequence?.every(
      (skill, index) => observedSkills[index] === skill,
    ) ?? true;
  const includesPassed =
    expected.includes?.every((skill) => observedSkills.includes(skill)) ?? true;
  const excludesPassed =
    expected.excludes?.every((skill) => !observedSkills.includes(skill)) ??
    true;
  return sequencePassed && includesPassed && excludesPassed;
}

function activationStatus(
  expected: ReturnType<typeof activationExpectation>,
  observed: ReturnType<typeof observedActivation>,
) {
  if (!observed) return "unavailable";
  const selected = observed.primarySkill === expected.targetSkill;
  const primaryPassed = (expected.activationClass !== "negative") === selected;
  return primaryPassed &&
    matchesSkillExpectations(expected, observed.observedSkills)
    ? "passed"
    : "failed";
}

function activationOutcomeData(
  expected: ReturnType<typeof activationExpectation>,
  observation: RecordValue | null,
  observed: ReturnType<typeof observedActivation>,
) {
  return {
    class: expected.activationClass,
    targetSkill: expected.targetSkill,
    ...(expected.sequence ? { expectedSkills: expected.sequence } : {}),
    ...(expected.includes ? { requiredSkills: expected.includes } : {}),
    ...(expected.excludes ? { excludedSkills: expected.excludes } : {}),
    source: observation?.source ?? null,
    primarySkill: observed?.primarySkill ?? null,
    observedSkills: observed?.observedSkills ?? [],
  };
}

function uniqueObservation(value: unknown, id: string): RecordValue | null {
  if (!Array.isArray(value))
    throw new Error("evaluation observations must be an array");
  const matches = value.filter(
    (item) => item && typeof item === "object" && item.id === id,
  );
  return matches.length === 1 ? record(matches[0], id) : null;
}

function validNativeToolCall(
  item: RecordValue,
  index: number,
  calls: RecordValue[],
): boolean {
  return (
    Number.isSafeInteger(item.ordinal) &&
    (item.ordinal as number) >= 0 &&
    (index === 0 ||
      (item.ordinal as number) > (calls[index - 1]!.ordinal as number)) &&
    ["functions", "collaboration", "clock", "other"].includes(
      String(item.namespace),
    ) &&
    typeof item.name === "string"
  );
}

function validAcceptedSpawn(item: RecordValue, calls: RecordValue[]): boolean {
  return (
    Number.isSafeInteger(item.requestedOrdinal) &&
    Number.isSafeInteger(item.startedOrdinal) &&
    Number.isSafeInteger(item.acceptedOrdinal) &&
    (item.requestedOrdinal as number) < (item.startedOrdinal as number) &&
    (item.startedOrdinal as number) < (item.acceptedOrdinal as number) &&
    typeof item.agentRef === "string" &&
    calls.some(
      (call) =>
        call.ordinal === item.requestedOrdinal &&
        call.namespace === "collaboration" &&
        call.name === "spawn_agent",
    )
  );
}

function nativeOwnershipEntries(data: RecordValue | null) {
  if (
    data?.method !== "native_session" ||
    !Array.isArray(data.toolCalls) ||
    !Array.isArray(data.acceptedSpawns) ||
    data.toolCalls.some((item) => !activationData(item)) ||
    data.acceptedSpawns.some((item) => !activationData(item))
  )
    return null;
  const calls = data.toolCalls as RecordValue[];
  const spawns = data.acceptedSpawns as RecordValue[];
  if (
    !calls.every(validNativeToolCall) ||
    !spawns.every((item) => validAcceptedSpawn(item, calls))
  )
    return null;
  return { calls, spawns };
}

function nativeOwnershipEvidence(value: unknown) {
  const observation = uniqueObservation(value, "sevro.codex.native-calls");
  if (
    observation?.source !== "sevro.host.codex" ||
    observation.completeness !== "complete"
  )
    return null;
  return nativeOwnershipEntries(activationData(observation.data));
}

function ownershipCheck(
  id: (typeof OWNERSHIP_CHECKS)[number],
  status: "passed" | "failed" | "unavailable",
  evidenceRef: string | null,
  detail: string,
) {
  return {
    id,
    status,
    detail,
    evidenceRefs: evidenceRef ? [evidenceRef] : [],
  };
}

function sameChildTarget(target: unknown, agentRef: string): boolean {
  return (
    target === agentRef ||
    (agentRef.startsWith("/root/") &&
      !agentRef.slice("/root/".length).includes("/") &&
      target === agentRef.slice("/root/".length))
  );
}

function parentWorkAfterAcceptance(
  calls: RecordValue[],
  accepted: RecordValue,
): boolean {
  return calls.some((call) => {
    if ((call.ordinal as number) <= (accepted.acceptedOrdinal as number))
      return false;
    if (call.namespace !== "collaboration") return true;
    if (call.name === "wait_agent") return false;
    if (
      ["followup_task", "send_message", "interrupt_agent"].includes(
        String(call.name),
      )
    )
      return !sameChildTarget(call.target, accepted.agentRef as string);
    return true;
  });
}

const INTERNAL_GOAL_FORMAT =
  /format\tdarrow-(?:native-goal|goal-step|claude-(?:agent-route|owner-route|route-gate|verify-route))-[^\s]+/;

type OwnershipStatus = "passed" | "failed" | "unavailable";

function singleOwnerStatus(
  evidence: ReturnType<typeof nativeOwnershipEvidence>,
): OwnershipStatus {
  if (!evidence) return "unavailable";
  return evidence.calls.filter(
    (call) => call.namespace === "collaboration" && call.name === "spawn_agent",
  ).length <= 1
    ? "passed"
    : "failed";
}

function parentActivityStatus(
  evidence: ReturnType<typeof nativeOwnershipEvidence>,
): OwnershipStatus {
  if (!evidence) return "unavailable";
  const spawnCount = evidence.calls.filter(
    (call) => call.namespace === "collaboration" && call.name === "spawn_agent",
  ).length;
  if (
    evidence.spawns.length > 1 ||
    (spawnCount > 0 && evidence.spawns.length !== 1)
  )
    return "unavailable";
  return evidence.spawns.length === 1 &&
    parentWorkAfterAcceptance(evidence.calls, evidence.spawns[0]!)
    ? "failed"
    : "passed";
}

function internalRecordCheck(observations: unknown) {
  const final = uniqueObservation(
    observations,
    "sevro.observation.final-message",
  );
  const text = final ? activationData(final.data)?.text : undefined;
  const available =
    final?.source === "sevro.host.codex" &&
    final.completeness === "complete" &&
    typeof text === "string";
  return ownershipCheck(
    OWNERSHIP_CHECKS[2],
    !available
      ? "unavailable"
      : INTERNAL_GOAL_FORMAT.test(text)
        ? "failed"
        : "passed",
    available ? "sevro.observation.final-message" : null,
    "Internal goal records are absent from the caller-facing response",
  );
}

function ownershipChecks(observations: unknown) {
  const evidence = nativeOwnershipEvidence(observations);
  const nativeRef = evidence ? "sevro.codex.native-calls" : null;
  return [
    ownershipCheck(
      OWNERSHIP_CHECKS[0],
      singleOwnerStatus(evidence),
      nativeRef,
      "No replacement owner is spawned after acceptance",
    ),
    ownershipCheck(
      OWNERSHIP_CHECKS[1],
      parentActivityStatus(evidence),
      nativeRef,
      "After acceptance the parent only waits or addresses the same owner",
    ),
    internalRecordCheck(observations),
  ];
}

function controlOrdinals(
  items: RecordValue[],
  namespace: string,
  name: string,
) {
  return items
    .filter((call) => call.namespace === namespace && call.name === name)
    .map((call) => call.ordinal);
}

function validDirectCalls(calls: RecordValue[], observed: RecordValue[]) {
  return (
    calls.every(validNativeToolCall) &&
    calls.every(
      (call) =>
        ["functions", "collaboration"].includes(String(call.namespace)) &&
        call.evidence === "invocation_attempt" &&
        observed.some(
          (tool) =>
            tool.ordinal === call.ordinal &&
            tool.namespace === call.namespace &&
            tool.name === call.name,
        ),
    )
  );
}

function nativeControlEvidence(observations: unknown) {
  const evidence = nativeOwnershipEvidence(observations);
  const observation = uniqueObservation(
    observations,
    "sevro.codex.native-calls",
  );
  const data = observation ? activationData(observation.data) : null;
  if (!evidence || !Array.isArray(data?.calls)) return null;
  const direct = data.calls.map(activationData);
  if (direct.some((call) => !call)) return null;
  const calls = direct as RecordValue[];
  if (!validDirectCalls(calls, evidence.calls)) return null;
  const matched = (namespace: string, name: string) =>
    JSON.stringify(controlOrdinals(evidence.calls, namespace, name)) ===
    JSON.stringify(controlOrdinals(calls, namespace, name));
  if (
    !matched("collaboration", "spawn_agent") ||
    !matched("functions", "create_goal") ||
    !matched("functions", "update_goal")
  )
    return null;
  return {
    attemptedSpawn:
      controlOrdinals(calls, "collaboration", "spawn_agent").length > 0,
    attemptedGoal:
      controlOrdinals(calls, "functions", "create_goal").length > 0,
    attemptedGoalControl: calls.some(
      (call) =>
        call.namespace === "functions" &&
        ["create_goal", "update_goal"].includes(String(call.name)),
    ),
    spawnCount: controlOrdinals(calls, "collaboration", "spawn_agent").length,
    acceptedSpawnCount: evidence.spawns.length,
    acceptedSpawns: evidence.spawns,
  };
}

function codexEventRef(artifacts: unknown) {
  if (!Array.isArray(artifacts)) return null;
  const matches = artifacts.filter(
    (item) =>
      item && typeof item === "object" && item.id === "sevro.codex.events",
  );
  if (matches.length !== 1) return null;
  const selected = record(matches[0], "Codex event artifact");
  if (
    typeof selected.path !== "string" ||
    !selected.path.startsWith("file:///") ||
    typeof selected.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(selected.sha256)
  )
    return null;
  return { path: selected.path, sha256: selected.sha256 };
}

async function codexEventText(artifacts: unknown): Promise<string | null> {
  const reference = codexEventRef(artifacts);
  if (!reference) return null;
  try {
    const path = fileURLToPath(reference.path);
    const entry = await lstat(path);
    if (
      !entry.isFile() ||
      entry.isSymbolicLink() ||
      entry.size > 8 * 1024 * 1024
    )
      return null;
    const bytes = await readFile(path);
    if (createHash("sha256").update(bytes).digest("hex") !== reference.sha256)
      return null;
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function noAgentOutcome(native: ReturnType<typeof nativeControlEvidence>) {
  return {
    status: native
      ? native.attemptedSpawn
        ? "failed"
        : "passed"
      : "unavailable",
    detail: native
      ? "Graded from complete native agent-spawn observations"
      : "Native agent-spawn observation unavailable or incomplete",
    evidenceRefs: native ? ["sevro.codex.native-calls"] : [],
  };
}

function noNativeGoalControlOutcome(
  native: ReturnType<typeof nativeControlEvidence>,
) {
  return {
    status: native
      ? native.attemptedGoalControl
        ? "failed"
        : "passed"
      : "unavailable",
    detail: native
      ? "Graded from complete native goal-control observations"
      : "Native goal-control observation unavailable or incomplete",
    evidenceRefs: native ? ["sevro.codex.native-calls"] : [],
  };
}

function oneOwnerOutcome(native: ReturnType<typeof nativeControlEvidence>) {
  return {
    status: native
      ? native.spawnCount === 1 && native.acceptedSpawnCount === 1
        ? "passed"
        : "failed"
      : "unavailable",
    detail: native
      ? "Graded from one correlated native owner acceptance"
      : "Native owner acceptance observation unavailable or incomplete",
    evidenceRefs: native ? ["sevro.codex.native-calls"] : [],
  };
}

function noLedgerOutcome(
  native: ReturnType<typeof nativeControlEvidence>,
  events: string | null,
  terms: unknown,
  forbidGoal: unknown,
) {
  if (!Array.isArray(terms) || !terms.every((term) => typeof term === "string"))
    throw new Error("ledger terms are invalid");
  if (typeof forbidGoal !== "boolean")
    throw new Error("ledger goal policy is invalid");
  if (!native || events === null)
    return {
      status: "unavailable",
      detail: "Codex event or native goal-control evidence unavailable",
      evidenceRefs: [],
    };
  const matched = terms.some((term) => events.includes(term));
  return {
    status:
      (forbidGoal && native.attemptedGoal) || matched ? "failed" : "passed",
    detail:
      "Graded from retained Codex events and complete native goal-control observations",
    evidenceRefs: ["sevro.codex.events", "sevro.codex.native-calls"],
  };
}

function validContinuationThread(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value);
}

function validContinuationComparison(
  observation: RecordValue | null,
  data: RecordValue | null,
): boolean {
  if (observation?.completeness === "complete")
    return typeof data?.preFollowUpWorktreeUnchanged === "boolean";
  return (
    observation?.completeness === "partial" &&
    data?.preFollowUpWorktreeUnchanged === null
  );
}

function validNativeAfterOrdinal(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (Number.isSafeInteger(value) && (value as number) >= 0)
  );
}

function validContinuationObservation(
  observation: RecordValue,
  data: RecordValue,
): boolean {
  return (
    observation.source === "sevro.host.codex" &&
    data.method === "same_thread_resume" &&
    validContinuationThread(data.threadId) &&
    validContinuationComparison(observation, data) &&
    validNativeAfterOrdinal(data.nativeAfterOrdinal)
  );
}

function continuationEvidence(observations: unknown) {
  const observation = uniqueObservation(
    observations,
    "sevro.codex.continuation",
  );
  const data = observation ? activationData(observation.data) : null;
  if (!observation || !data || !validContinuationObservation(observation, data))
    return null;
  return {
    nativeAfterOrdinal: (data.nativeAfterOrdinal as number | null) ?? null,
    unchanged:
      observation.completeness === "complete"
        ? (data.preFollowUpWorktreeUnchanged as boolean)
        : null,
  };
}

function ownerBoundaryOutcome(
  kind: string,
  native: ReturnType<typeof nativeControlEvidence>,
  continuation: ReturnType<typeof continuationEvidence>,
) {
  const boundary = continuation?.nativeAfterOrdinal;
  if (!native || boundary === null || boundary === undefined)
    return {
      status: "unavailable",
      detail: "Complete native owner evidence and follow-up ordinal required",
      evidenceRefs: [],
    };
  const acceptedAfter = native.acceptedSpawns.some(
    (spawn) => (spawn.acceptedOrdinal as number) > boundary,
  );
  const acceptedBefore = native.acceptedSpawns.some(
    (spawn) => (spawn.acceptedOrdinal as number) <= boundary,
  );
  return {
    status: (
      kind === "owner-after-continuation" ? acceptedAfter : !acceptedBefore
    )
      ? "passed"
      : "failed",
    detail:
      "Graded from correlated owner acceptance and native follow-up ordinal",
    evidenceRefs: ["sevro.codex.native-calls", "sevro.codex.continuation"],
  };
}

function continuationOutcome(
  kind: string,
  evidence: ReturnType<typeof continuationEvidence>,
) {
  const status = !evidence
    ? "unavailable"
    : kind === "continuation-boundary"
      ? "passed"
      : evidence.unchanged === null
        ? "unavailable"
        : evidence.unchanged
          ? "passed"
          : "failed";
  return {
    status,
    detail:
      status === "unavailable"
        ? "Codex continuation boundary or workspace comparison unavailable"
        : "Graded from the Codex same-thread continuation boundary",
    evidenceRefs: evidence ? ["sevro.codex.continuation"] : [],
  };
}

function transcriptOutcome(
  selected: RecordValue,
  native: ReturnType<typeof nativeControlEvidence>,
  events: string | null,
  continuation: ReturnType<typeof continuationEvidence>,
) {
  if (selected.kind === "no-agent-spawn") return noAgentOutcome(native);
  if (selected.kind === "no-native-goal-control")
    return noNativeGoalControlOutcome(native);
  if (selected.kind === "one-owner-accepted") return oneOwnerOutcome(native);
  if (selected.kind === "no-lifecycle-ledger")
    return noLedgerOutcome(native, events, selected.terms, selected.forbidGoal);
  if (
    selected.kind === "continuation-boundary" ||
    selected.kind === "unchanged-before-continuation"
  )
    return continuationOutcome(selected.kind, continuation);
  if (
    selected.kind === "owner-after-continuation" ||
    selected.kind === "no-owner-before-continuation"
  )
    return ownerBoundaryOutcome(selected.kind, native, continuation);
  throw new Error("unsupported native transcript check");
}

async function nativeTranscriptChecks(
  value: unknown,
  observations: unknown,
  artifacts: unknown,
) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.length)
    throw new Error("native transcript checks are invalid");
  const evidence = nativeControlEvidence(observations);
  const continuation = value.some((entry) =>
    [
      "continuation-boundary",
      "unchanged-before-continuation",
      "owner-after-continuation",
      "no-owner-before-continuation",
    ].includes(String(record(entry, "native transcript check").kind)),
  )
    ? continuationEvidence(observations)
    : null;
  const events = value.some(
    (entry) =>
      record(entry, "native transcript check").kind === "no-lifecycle-ledger",
  )
    ? await codexEventText(artifacts)
    : null;
  return value.map((entry) => {
    const selected = record(entry, "native transcript check");
    return {
      id: string(selected.id, "native transcript check ID"),
      ...transcriptOutcome(selected, evidence, events, continuation),
    };
  });
}

function measuredMetric(
  label: string,
  checkIds: string[],
  checks: RecordValue[],
  execution: string,
) {
  const statuses = checkIds.map((id) =>
    checks.filter((check) => check.id === id),
  );
  const complete =
    execution === "completed" &&
    statuses.every(
      (matches) =>
        matches.length === 1 &&
        (matches[0]?.status === "passed" || matches[0]?.status === "failed"),
    );
  const passed = statuses.filter(
    (matches) => matches[0]?.status === "passed",
  ).length;
  const value = complete
    ? label === "defect_detection"
      ? passed / checkIds.length
      : checkIds.length - passed
    : null;
  return {
    id: `darrow.evals.metric.${label.replaceAll("_", "-")}`,
    value,
    unit: label === "defect_detection" ? "ratio" : "count",
  };
}

function caseMetrics(details: RecordValue, params: RecordValue) {
  if (details.checkMetrics === undefined) return [];
  if (
    !Array.isArray(details.checkMetrics) ||
    !Array.isArray(params.builtinChecks)
  )
    throw new Error("metric evidence is invalid");
  const specifications = details.checkMetrics.map((entry) => {
    const specification = record(entry, "check metric");
    const metric = checkMetric(specification.metric, "check metric");
    if (!metric) throw new Error("check metric is missing");
    return {
      checkId: string(specification.checkId, "metric check ID"),
      metric,
    };
  });
  const checks = params.builtinChecks.map((entry) =>
    record(entry, "built-in check"),
  );
  const execution = string(
    record(params.execution, "execution").status,
    "execution status",
  );
  return [...METRIC_LABELS].flatMap((label) => {
    const ids = specifications
      .filter((specification) => specification.metric === label)
      .map((specification) => specification.checkId);
    return ids.length ? [measuredMetric(label, ids, checks, execution)] : [];
  });
}

async function evaluateCase(params: RecordValue) {
  const omitSkills = withoutSkill(params.configuration);
  const extensionData = record(
    params.extensionData,
    "evaluation extension data",
  );
  const details = record(extensionData["darrow.case"], "Darrow case data");
  const metrics = caseMetrics(details, params);
  const ownership =
    details.ownership === true || details.ownership === "composition"
      ? ownershipChecks(params.observations)
      : [];
  const checks = [
    ...(details.ownership === "composition"
      ? ownership.slice(0, 2)
      : ownership),
    ...(await nativeTranscriptChecks(
      details.transcriptChecks,
      params.observations,
      params.artifacts,
    )),
  ];
  if (omitSkills || details.activation === undefined)
    return { checks, metrics, domainOutcomes: [] };
  const expected = activationExpectation(details.activation);
  const explicit = details.invocation !== undefined;
  const observation = activationObservation(params.observations, explicit);
  const observed = observedActivation(observation, explicit);
  const status = activationStatus(expected, observed);
  return {
    checks,
    metrics,
    domainOutcomes: [
      {
        id: "darrow.evals.activation",
        status,
        evidenceRefs: observation
          ? [string(observation.id, "activation evidence ID")]
          : [],
        detail: observed
          ? "Activation graded from complete host observation"
          : "Activation observation unavailable or incomplete",
        data: activationOutcomeData(expected, observation, observed),
      },
    ],
  };
}

if (import.meta.main) {
  const requestText = await Bun.stdin.text();
  if (Buffer.byteLength(requestText, "utf8") > 8 * 1024 * 1024)
    throw new Error("extension request is too large");
  const request = record(JSON.parse(requestText) as unknown, "request");
  const id = string(request.id, "request ID");
  const method = string(request.method, "request method");
  const protocol =
    method === "describe" ? "sevro.discovery.v1" : "sevro.extension.v1";
  if (request.protocol !== protocol)
    throw new Error("extension protocol mismatch");
  let response: RecordValue;
  try {
    const params = record(request.params, "request params");
    const result =
      method === "describe"
        ? {
            extension: { id: "darrow.evals", version: "0.1.0" },
            protocols: ["sevro.extension.v1"],
            requiredCapabilities: ["sevro.host.exec"],
            optionalCapabilities: [
              "sevro.fixture.setup",
              "sevro.host.continuation",
              "sevro.codex.plugin-marketplace",
              "sevro.codex.explicit-invocation",
              "sevro.codex.native-calls",
            ],
            graders: ["darrow.evals.ownership", "darrow.evals.transcript"],
            taskVerdictPolicies: [],
          }
        : method === "resolve"
          ? await resolveCase(params)
          : method === "prepare"
            ? await prepareCase(params)
            : method === "evaluate"
              ? await evaluateCase(params)
              : (() => {
                  throw new Error("unsupported extension method");
                })();
    response = { protocol, id, method, result };
  } catch (error) {
    response = {
      protocol,
      id,
      method,
      error: {
        code: "darrow.extension.invalid",
        message: (error instanceof Error
          ? error.message
          : "extension failed"
        ).slice(0, 4096),
      },
    };
  }
  process.stdout.write(JSON.stringify(response));
}
