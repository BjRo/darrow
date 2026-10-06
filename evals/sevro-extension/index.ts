#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { nativeOwnerRouteChecks } from "./benchmark-owner";
import { nativeGoalPolicy, nativeGoalOutcomes } from "./native-goal-policy";
import {
  nativeTranscriptPolicy,
  nativeTranscriptOutcomes,
  nativeTranscriptEvidence,
  type NativeTranscript,
} from "./native-transcript-policy";
import {
  benchmarkCasePolicy,
  benchmarkRecordChecks,
  type BenchmarkPolicyConfiguration,
} from "./benchmark-policy";
import { parse as parseYaml } from "yaml";
import { TICKETCTL } from "../fixture-ticket";
import {
  caseWithCondition,
  conditionedCase,
  extensionConfiguration,
} from "./benchmark-condition";
import {
  loadSkillOverride,
  skillMountConfiguration,
  type SkillMountConfiguration,
} from "./skill-mount";

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
  const history = fixture.commits === undefined ? [] : fixture.commits;
  if (
    !Array.isArray(history) ||
    (!history.length && fixture.setup === undefined)
  )
    throw new Error("case needs a generated Git history");
  const commits = history.map((entry, index) => {
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

const GUIDE_DISCLOSURE_SCRIPT = `if [ "$DARROW_EVAL_HARNESS" = claude ] && [ -f .git/last-message.md ]; then grep -Ei "best.effort" .git/last-message.md >/dev/null && grep -Ei "primar[^.]*Codex|Codex[^.]*primar" .git/last-message.md >/dev/null; fi`;

function guideDisclosure(run: string, skillDir: string | null) {
  if (skillDir !== ".agents/skills/darrow-guide") return false;
  if (run.replace(/\s+/g, " ").trim() === GUIDE_DISCLOSURE_SCRIPT) return true;
  if (
    run.includes("$DARROW_EVAL_HARNESS") ||
    run.includes(".git/last-message.md")
  )
    throw new Error("unsupported legacy guide response check");
  return false;
}

function shellConfiguration(check: RecordValue, run: string) {
  if (check.exit_code !== undefined && check.expect_exit !== undefined)
    throw new Error("check declares both exit code fields");
  return {
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
}

function shellChecks(value: unknown, skillDir: string | null) {
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
    const disclosure = guideDisclosure(run, skillDir);
    if (disclosure) keys(check, ["name", "run"], "guide disclosure check");
    const configuration = disclosure ? {} : shellConfiguration(check, run);
    return {
      id: disclosure
        ? `darrow.evals.disclosure.${index + 1}`
        : `darrow.shell.${index + 1}`,
      grader: disclosure ? "darrow.evals.disclosure" : "sevro.shell",
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

function semanticArtifactChecks(value: unknown) {
  if (value === undefined) return [];
  const config = record(value, "semantic artifact");
  keys(config, ["path", "checks"], "semantic artifact");
  const path = string(config.path, "semantic artifact path");
  if (
    isAbsolute(path) ||
    path.includes("\\") ||
    path.split("/").some((part) => part === ".." || part === ".git") ||
    dirname(path).includes("*") ||
    !/^[^*]*\*?[^*]*$/.test(path.split("/").at(-1)!)
  )
    throw new Error(
      "semantic artifact path must be relative with at most one basename *",
    );
  if (!Array.isArray(config.checks) || !config.checks.length)
    throw new Error("semantic artifact checks must be nonempty");
  return semanticOutputChecks(config.checks).map((check, index) => ({
    ...check,
    id: `darrow.semantic-artifact.${index + 1}`,
    configuration: { ...check.configuration, artifactPath: path },
  }));
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
  if (/^\.agents\/skills\/[^/]+\/evals\/[^/]+\.yaml$/.test(source))
    return parts.slice(0, 3).join("/");
  if (/^plugins\/[^/]+\/[^/]+\/skills\/[^/]+\/evals\/[^/]+\.yaml$/.test(source))
    return parts.slice(0, 5).join("/");
  return null;
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
  mounts: { siblings: boolean; supporting: boolean },
  sequence: string[] | undefined,
): asserts value is "positive" | "negative" | "competition" {
  if (value !== "positive" && value !== "negative" && value !== "competition")
    throw new Error("case uses an unsupported activation class");
  if (value === "competition" && !mounts.siblings)
    throw new Error("competition activation requires sibling skill mounts");
  validateActivationSequence(value, targetSkill, mounts.supporting, sequence);
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
    {
      siblings: mountPluginSkills,
      supporting:
        mountPluginSkills ||
        selected.additional_plugins !== undefined ||
        selected.additional_skills !== undefined,
    },
    lists.sequence,
  );
  return {
    activation: { class: value, targetSkill, ...lists },
  };
}

function caseMount(
  value: unknown,
  source: string,
  root: string,
  configuration: SkillMountConfiguration,
) {
  const skillDir = configuration.skillDir ?? skillDirForSource(source);
  if (value !== undefined && typeof value !== "boolean")
    throw new Error("mount_plugin_skills must be a boolean");
  const mountPluginSkills =
    value === true || configuration.mountPluginSkills === true;
  if (mountPluginSkills && skillDir?.startsWith(".agents/"))
    throw new Error("repository skills cannot request plugin sibling mounts");
  if (mountPluginSkills && !skillDir)
    throw new Error("sibling skill mounts require a colocated owning skill");
  return {
    skillDir,
    mountPluginSkills,
    ...mountDetails(root, skillDir, mountPluginSkills, configuration),
  };
}

function mountDetails(
  root: string,
  skillDir: string | null,
  mountPluginSkills: boolean,
  configuration: SkillMountConfiguration,
) {
  if (!skillDir) return {};
  const override = skillMountConfiguration(configuration);
  return {
    mount: {
      projectRoot: pathToFileURL(root).href,
      skillDir,
      mountPluginSkills,
      ...(Object.keys(override).length ? { configuration: override } : {}),
    },
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

function casePrompt(
  value: unknown,
  invocation: string | null,
  deferRoute = false,
) {
  const prompt = string(value, "case prompt");
  if (prompt.includes("{{skill_invocation}}") && !invocation)
    throw new Error("skill invocation requires a plugin-local case");
  const template = deferRoute
    ? prompt.replace(/\{\{(?:harness|model|effort)\}\}/g, "")
    : prompt;
  if (
    template
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
  if (skillDir.startsWith(".agents/"))
    return {
      scope: "repository" as const,
      skillName: skillDir.split("/").at(-1)!,
    };
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
  "semantic_artifact",
  "native_goal",
  "activation",
  "activation_sequence",
  "activation_includes",
  "activation_excludes",
  "mount_plugin_skills",
  "additional_plugins",
  "additional_skills",
  "goal_report",
  "goal_route_checks",
  "adaptive_goal_composition",
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
  'adaptive-goal-preflight step|Protocol ledger|"tool":"create_goal"';
const NO_PREFLIGHT_GOAL_PATTERN =
  'adaptive-goal-preflight step|"tool":"create_goal"';
const NO_LEDGER_TRANSCRIPT_PATTERNS = new Set([
  NO_LEDGER_TRANSCRIPT_PATTERN,
  NO_PREFLIGHT_GOAL_PATTERN,
  "adaptive-goal-preflight step|darrow-native-goal-report",
  "adaptive-goal-preflight step|Protocol ledger",
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
const CROSS_TURN_UNCHANGED_PATTERN =
  '"type":"darrow.eval.follow_up_turn"[^\\n]*"pre_feedback_worktree_unchanged":true|"type":"darrow.goal_agent_completion"';
const CROSS_TURN_OWNER_BEFORE_PATTERN =
  '(?:"type":"darrow.goal_agent_completion"[^\\n]*"status":"completed"[^\\n]*"agent_id":"[^"]+"[\\s\\S]*"type":"darrow.eval.follow_up_turn"|"tool":"spawn_agent"[^\\n]*"status":"completed"[^\\n]*"receiver_thread_ids":\\["[^"]+"\\][^\\n]*"prompt":"- phase: adaptive-goal-owner"[\\s\\S]*"type":"darrow.eval.follow_up_turn"|"type":"darrow.codex_native_single_agent_accepted"[^\\n]*"accepted_before_follow_up":true)';
const CROSS_TURN_SAME_OWNER_PATTERN =
  '(?:"type":"darrow.goal_agent_completion"[^\\n]*"agent_id":"([^"]+)"[\\s\\S]*"type":"darrow.human_feedback_request"[^\\n]*"agent_id":"\\1"[^\\n]*"question_present":true[\\s\\S]*"type":"darrow.eval.follow_up_turn"[\\s\\S]*"type":"darrow.human_feedback_relay"[^\\n]*"agent_id":"\\1"[^\\n]*"same_owner":true[\\s\\S]*"type":"darrow.goal_agent_resumption"[^\\n]*"agent_id":"\\1"[^\\n]*"status":"completed"[^\\n]*"same_owner":true|"tool":"spawn_agent"[^\\n]*"status":"completed"[^\\n]*"receiver_thread_ids":\\["([^"]+)"\\][^\\n]*"agent_ref":"\\2"[\\s\\S]*"type":"darrow.eval.follow_up_turn"[\\s\\S]*"tool":"(?:followup_task|send_input)"[^\\n]*"status":"completed"[^\\n]*"receiver_thread_ids":\\["\\2"\\][^\\n]*"agent_ref":"\\2"|"type":"darrow.codex_native_single_agent_accepted"[^\\n]*"agent_ref":"([^"]+)"[\\s\\S]*"type":"darrow.codex_native_feedback"[^\\n]*"tool":"(?:followup_task|send_message)"[^\\n]*"agent_ref":"\\3"[^\\n]*"same_owner":true[^\\n]*"after_follow_up":true[^\\n]*"delivery":"unverified")';
const CROSS_TURN_NO_REPLACEMENT_PATTERN =
  '"type":"darrow.eval.follow_up_turn"[\\s\\S]*(?:"type":"darrow.parent_spawn_after_goal"|"tool":"spawn_agent"|adaptive-goal-preflight step|Protocol ledger|"tool":"create_goal")';
const CONTINUATION_CHANGED_PATTERN = String.raw`"type":"darrow\.eval\.follow_up_turn"(?![^\n]*"pre_feedback_worktree_unchanged":true)[^\n]*[\s\S]*"type":"darrow\.codex_native_`;
const OWNER_AFTER_CONTINUATION_PATTERN = String.raw`"type":"darrow.eval.follow_up_turn"[\s\S]*"type":"(?:darrow\.codex_native_single_agent_accepted|darrow\.goal_agent_completion)"`;
const NO_OWNER_BEFORE_CONTINUATION_PATTERN = String.raw`"type":"(?:darrow\.codex_native_single_agent_accepted|darrow\.goal_agent_completion)"[\s\S]*"type":"darrow.eval.follow_up_turn"`;
const NO_NATIVE_GOAL_CONTROL_PATTERN = String.raw`"type":"darrow\.codex_native_goal_control"[^\n]*"tool":"(?:create_goal|update_goal)"`;
const NO_OWNER_OR_GOAL_CONTROL_PATTERN = String.raw`"type":"darrow\.(?:codex_native_goal_control|codex_native_spawn|codex_native_single_agent_accepted|goal_agent_completion|review_agent_launch)"`;
const PR_EVIDENCE_INACTIVE_PATTERN = String.raw`"skill":"publish-pr-evidence"|"name":"Skill"[^\n]*publish-pr-evidence`;
const TICKET_RECIPE_INACTIVE_PATTERN = String.raw`"skill":"ticket-to-pr"|"skill":"adaptive-goal"|"name":"Skill"[^\n]*(?:ticket-to-pr|adaptive-goal)|"tool":"spawn_agent"`;
const STEERING_SAME_OWNER_PATTERN = String.raw`(?:"type":"darrow.codex_native_single_agent_accepted"[^\n]*"agent_ref":"([^"]+)"[\s\S]*"type":"darrow.codex_native_feedback"[^\n]*"tool":"(?:followup_task|send_message)"[^\n]*"agent_ref":"\1"[^\n]*"same_owner":true[^\n]*"after_follow_up":true[^\n]*"delivery":"unverified"|"type":"darrow.goal_agent_completion"[^\n]*"agent_id":"([^"]+)"[\s\S]*"type":"darrow.goal_agent_resumption"[^\n]*"agent_id":"\2"[^\n]*"same_owner":true)`;
const REJECTED_FEEDBACK_PATTERN = String.raw`(?:"type":"darrow.human_feedback_relay"[^\n]*"same_owner":true[\s\S]*"type":"darrow.goal_agent_resumption"[^\n]*"same_owner":true|"type":"darrow.codex_native_feedback"[^\n]*"tool":"(?:followup_task|send_message)"[^\n]*"same_owner":true[^\n]*"after_follow_up":true[^\n]*"response_observed":true)`;
const RELAYED_FEEDBACK_PATTERN = String.raw`(?:"type":"darrow.human_feedback_relay"[^\n]*"same_owner":true[\s\S]*"type":"darrow.goal_agent_resumption"[^\n]*"status":"completed"[^\n]*"same_owner":true|"type":"darrow.codex_native_feedback"[^\n]*"tool":"(?:followup_task|send_message)"[^\n]*"same_owner":true[^\n]*"after_follow_up":true[^\n]*"response_observed":true)`;
const NONREADY_SKILL_READ_PATTERN =
  '"skill":"(?:darrow-readiness-gate:)?assess-implementation-readiness"';
const NONREADY_NO_REPEATED_READ_PATTERN =
  '"skill":"(?:darrow-readiness-gate:)?assess-implementation-readiness"[\\s\\S]*"skill":"(?:darrow-readiness-gate:)?assess-implementation-readiness"';
const NONREADY_NO_OWNER_PATTERN =
  '"tool":"spawn_agent"|"type":"(?:darrow\\.codex_native_spawn|darrow\\.codex_native_single_agent_accepted|darrow\\.goal_agent_completion)"|"name":"Agent"';
const READINESS_PRE_OWNER_PATTERN =
  '"type":"darrow\\.codex_native_pre_owner_skill_read","actor":"parent","pre_owner_skill":"assess-implementation-readiness","status":"completed"|"skill":"(?:darrow-readiness-gate:)?assess-implementation-readiness"[\\s\\S]*"type":"darrow\\.goal_agent_completion"';
const READINESS_BEFORE_CONTINUATION_PATTERN = String.raw`"skill":"(?:darrow-readiness-gate:)?assess-implementation-readiness"[\s\S]*"type":"darrow.eval.follow_up_turn"`;
const READINESS_AFTER_CONTINUATION_PATTERN = String.raw`"type":"darrow.eval.follow_up_turn"[\s\S]*"skill":"(?:darrow-readiness-gate:)?assess-implementation-readiness"`;
const TICKET_REINVOKED_AFTER_CONTINUATION_PATTERN = String.raw`"type":"darrow.eval.follow_up_turn"[\s\S]*(?:"name":"Skill"[^\n]*ticket-to-pr|"type":"darrow.skill_read_probe"[^\n]*"skill":"ticket-to-pr")`;
const PLAINTEXT_FEEDBACK_MISMATCH_PATTERN = String.raw`"type":"darrow.codex_native_feedback"[^\n]*"message_representation":"plaintext"[^\n]*"message_matches_expected":false`;
const SECOND_OWNER_PATTERN = String.raw`(?:"type":"darrow.parent_spawn_after_goal"|"tool":"spawn_agent"[^\n]*"status":"completed"[^\n]*[\s\S]*"tool":"spawn_agent"[^\n]*"status":"completed")`;
const TWO_OWNER_COMPLETIONS_PATTERN = String.raw`"type":"(?:darrow\.codex_native_single_agent_accepted|darrow\.goal_agent_completion)"[\s\S]*"type":"(?:darrow\.codex_native_single_agent_accepted|darrow\.goal_agent_completion)"`;
const OWNER_ROUTE_PATTERNS = new Map([
  [
    String.raw`(?:"type":"darrow\.codex_native_single_agent_accepted"[^\n]*"model":"gpt-6-luna","reasoning_effort":"medium"|"type":"darrow\.goal_agent_completion"[^\n]*"subagent_type":"darrow-adaptive-goal:adaptive-goal-sonnet-5-5-(?:low|medium)")`,
    { model: "gpt-6-luna", reasoningEffort: "medium" },
  ],
  [
    String.raw`(?:"type":"darrow\.codex_native_single_agent_accepted"[^\n]*"model":"gpt-6-luna","reasoning_effort":"high"|"type":"darrow\.goal_agent_completion"[^\n]*"subagent_type":"darrow-adaptive-goal:adaptive-goal-sonnet-5-5-medium")`,
    { model: "gpt-6-luna", reasoningEffort: "high" },
  ],
  [
    String.raw`(?:"type":"darrow\.codex_native_single_agent_accepted"[^\n]*"model":"gpt-6-astra","reasoning_effort":"high"|"type":"darrow\.goal_agent_completion"[^\n]*"subagent_type":"darrow-adaptive-goal:adaptive-goal-opus-5-5-high")`,
    { model: "gpt-6-astra", reasoningEffort: "high" },
  ],
]);
const SPEC_NESTED_READER_PATTERN = String.raw`"type":"darrow.codex_native_nested_spawn"[^\n]*"status":"accepted"[^\n]*"review_axis":"spec"[^\n]*"fork_turns":"none"[^\n]*"session_status":"available"[^\n]*"reader_result_status":"completed"[^\n]*"children_truncated":false[^\n]*"requests_truncated":false|"name":"Agent"[\s\S]*"name":"Agent"`;
const DUAL_NESTED_READER_PATTERN = String.raw`(?=[\s\S]*"type":"darrow.codex_native_nested_spawn"[^\n]*"status":"accepted"[^\n]*"review_axis":"standards"[^\n]*"fork_turns":"none"[^\n]*"session_status":"available"[^\n]*"reader_result_status":"completed"[^\n]*"children_truncated":false[^\n]*"requests_truncated":false)(?=[\s\S]*"type":"darrow.codex_native_nested_spawn"[^\n]*"status":"accepted"[^\n]*"review_axis":"spec"[^\n]*"fork_turns":"none"[^\n]*"session_status":"available"[^\n]*"reader_result_status":"completed"[^\n]*"children_truncated":false[^\n]*"requests_truncated":false)[\s\S]+|"name":"Agent"[\s\S]*"name":"Agent"[\s\S]*"name":"Agent"`;
const NO_INHERITED_READER_CONTEXT_PATTERN = String.raw`"subagent_type":"fork"|"type":"darrow.codex_native_(nested_)?spawn"[^\n]*"fork_turns":"(all|[1-9][0-9]*)"`;
const FRESH_PROVIDER_CONTEXT_PATTERN = String.raw`"type":"darrow.codex_native_spawn"[^\n]*"fork_turns":"none"|"name":"Agent"`;
const ACCEPTED_CHILD_SESSION_PATTERN = String.raw`"type":"darrow.codex_native_child_skill_evidence"[^\n]*"actor":"accepted_child"[^\n]*"session_status":"available"|"name":"Agent"`;
const DOCTOR_NO_ORCHESTRATION_PATTERN = String.raw`"skill":"adaptive-goal"|adaptive-goal-preflight|"tool":"spawn_agent"`;
const DOCTOR_NO_ORCHESTRATION_AGENT_PATTERN = String.raw`"skill":"adaptive-goal"|adaptive-goal-preflight|"tool":"spawn_agent"|"name":"Agent"`;
const DOCTOR_NO_PREFLIGHT_AGENT_PATTERN = String.raw`adaptive-goal-preflight|"tool":"spawn_agent"|"name":"Agent"`;
const DOCTOR_NO_HOST_CHOICE_PATTERN = String.raw`host-config-doctor|adaptive-goal-preflight|"tool":"spawn_agent"|"name":"Agent"`;
const DOCTOR_INACTIVE_PATTERN = String.raw`"skill":"doctor-adaptive-goal"|host-config-doctor`;
const TICKET_INPUT_NO_DELEGATION_PATTERN = String.raw`(?:"name":"Skill"[^\n]*adaptive-goal|"type":"darrow.skill_read_probe"[^\n]*"skill":"adaptive-goal")`;
const ADVICE_ONLY_NO_OWNER_PATTERN = String.raw`"tool":"spawn_agent"|"type":"(?:darrow\.codex_native_spawn|darrow\.codex_native_single_agent_accepted|darrow\.goal_agent_completion)"|"name":"Agent"|adaptive-goal-preflight (?:prepare|route|step)`;
const ADAPTIVE_SUPPORTING_READ_PATTERN = String.raw`(?:"name":"Skill"[^\n]*adaptive-goal|"type":"darrow.skill_read_probe"[^\n]*"skill":"adaptive-goal"[^\n]*"status":"completed")`;
const TICKET_PRE_RUN_PATTERN = String.raw`(?:"name":"Skill"[^\n]*(?:read-ticket|assess-implementation-readiness|prepare-task-branch)|"type":"darrow.skill_read_probe"[^\n]*"skill":"(?:read-ticket|assess-implementation-readiness|prepare-task-branch)")`;
const TICKET_UNAVAILABLE_PATTERN = String.raw`(?:"name":"Skill"[^\n]*(?:read-ticket|assess-implementation-readiness|prepare-task-branch)|"type":"darrow.skill_read_probe"[^\n]*"skill":"(?:read-ticket|assess-implementation-readiness|prepare-task-branch)|"tool":"spawn_agent"|"name":"Agent")`;
const PUBLISHER_READ_PATTERNS = new Map([
  [
    String.raw`(?:"type":"darrow.skill_read_probe"[^\n]*"skill":"create-pr"[^\n]*"status":"completed"|"name":"Skill"[^\n]*"skill":"[^"]*create-pr")`,
    "create-pr",
  ],
  [
    String.raw`(?:"type":"darrow.skill_read_probe"[^\n]*"skill":"ship-proposal"[^\n]*"status":"completed"|"name":"Skill"[^\n]*"skill":"[^"]*ship-proposal")`,
    "ship-proposal",
  ],
]);
const PARENT_TOOL_AFTER_AGENT_PATTERN =
  '"type":"darrow.codex_native_parent_tool_after_agent"';
const ORDINARY_ENGINEERING_NO_ADAPTIVE_DELIVERY_PATTERN = String.raw`"skill":"adaptive-goal"|adaptive-goal-preflight prepare|"type":"(?:darrow\.codex_native_spawn|darrow\.codex_native_single_agent_accepted|darrow\.goal_agent_completion)"|"name":"Agent"[^\n]*"adaptive-goal-owner"`;
const FORBIDDEN_EVENT_REGEX = new Map([
  [
    TICKET_INPUT_NO_DELEGATION_PATTERN,
    new RegExp(TICKET_INPUT_NO_DELEGATION_PATTERN),
  ],
  [ADVICE_ONLY_NO_OWNER_PATTERN, new RegExp(ADVICE_ONLY_NO_OWNER_PATTERN)],
  [
    ORDINARY_ENGINEERING_NO_ADAPTIVE_DELIVERY_PATTERN,
    new RegExp(ORDINARY_ENGINEERING_NO_ADAPTIVE_DELIVERY_PATTERN),
  ],
  [TICKET_PRE_RUN_PATTERN, new RegExp(TICKET_PRE_RUN_PATTERN)],
  [TICKET_UNAVAILABLE_PATTERN, new RegExp(TICKET_UNAVAILABLE_PATTERN)],
]);
const SAME_OWNER_FEEDBACK_PATTERNS = new Map([
  [STEERING_SAME_OWNER_PATTERN, false],
  [CROSS_TURN_SAME_OWNER_PATTERN, false],
  [REJECTED_FEEDBACK_PATTERN, true],
  [RELAYED_FEEDBACK_PATTERN, true],
]);
const SPECIAL_NEGATIVE_TRANSCRIPT_KINDS = new Map<
  string,
  {
    kind: string;
    forbiddenSkills?: string[];
    forbidSpawn?: boolean;
    skill?: string;
    max?: number;
    forbidNativeSkillCall?: boolean;
    forbiddenEventTerms?: string[];
    forbiddenEventPattern?: string;
    forbidAgentTool?: boolean;
  }
>([
  [
    NONREADY_NO_REPEATED_READ_PATTERN,
    {
      kind: "parent-skill-read-count",
      skill: "assess-implementation-readiness",
      max: 1,
    },
  ],
  [
    NONREADY_NO_OWNER_PATTERN,
    {
      kind: "inactive-controls",
      forbidSpawn: true,
      forbidAgentTool: true,
    },
  ],
  [
    CROSS_TURN_NO_REPLACEMENT_PATTERN,
    { kind: "no-replacement-after-continuation" },
  ],
  [CONTINUATION_CHANGED_PATTERN, { kind: "unchanged-before-continuation" }],
  [
    NO_OWNER_BEFORE_CONTINUATION_PATTERN,
    { kind: "no-owner-before-continuation" },
  ],
  [NO_NATIVE_GOAL_CONTROL_PATTERN, { kind: "no-native-goal-control" }],
  [NO_OWNER_OR_GOAL_CONTROL_PATTERN, { kind: "no-owner-or-goal-control" }],
  [
    PLAINTEXT_FEEDBACK_MISMATCH_PATTERN,
    { kind: "no-plaintext-feedback-mismatch" },
  ],
  [SECOND_OWNER_PATTERN, { kind: "no-second-owner" }],
  [TWO_OWNER_COMPLETIONS_PATTERN, { kind: "no-second-owner" }],
  [PARENT_TOOL_AFTER_AGENT_PATTERN, { kind: "no-parent-work-after-handoff" }],
  [
    DOCTOR_NO_ORCHESTRATION_PATTERN,
    {
      kind: "inactive-controls",
      forbiddenSkills: ["adaptive-goal"],
      forbiddenEventTerms: [
        '"skill":"adaptive-goal"',
        "adaptive-goal-preflight",
      ],
      forbidSpawn: true,
    },
  ],
  [
    DOCTOR_NO_ORCHESTRATION_AGENT_PATTERN,
    {
      kind: "inactive-controls",
      forbiddenSkills: ["adaptive-goal"],
      forbiddenEventTerms: [
        '"skill":"adaptive-goal"',
        "adaptive-goal-preflight",
      ],
      forbidSpawn: true,
      forbidAgentTool: true,
    },
  ],
  [
    DOCTOR_NO_PREFLIGHT_AGENT_PATTERN,
    {
      kind: "inactive-controls",
      forbiddenEventTerms: ["adaptive-goal-preflight"],
      forbidSpawn: true,
      forbidAgentTool: true,
    },
  ],
  [
    DOCTOR_NO_HOST_CHOICE_PATTERN,
    {
      kind: "inactive-controls",
      forbiddenEventTerms: ["host-config-doctor", "adaptive-goal-preflight"],
      forbidSpawn: true,
      forbidAgentTool: true,
    },
  ],
  [
    DOCTOR_INACTIVE_PATTERN,
    {
      kind: "inactive-controls",
      forbiddenSkills: ["doctor-adaptive-goal"],
      forbiddenEventTerms: [
        '"skill":"doctor-adaptive-goal"',
        "host-config-doctor",
      ],
    },
  ],
  [
    TICKET_INPUT_NO_DELEGATION_PATTERN,
    {
      kind: "inactive-controls",
      forbiddenSkills: ["adaptive-goal"],
      forbiddenEventPattern: TICKET_INPUT_NO_DELEGATION_PATTERN,
    },
  ],
  [
    ADVICE_ONLY_NO_OWNER_PATTERN,
    {
      kind: "inactive-controls",
      forbiddenEventPattern: ADVICE_ONLY_NO_OWNER_PATTERN,
      forbidSpawn: true,
      forbidAgentTool: true,
    },
  ],
  [
    ORDINARY_ENGINEERING_NO_ADAPTIVE_DELIVERY_PATTERN,
    {
      kind: "inactive-controls",
      forbiddenSkills: ["adaptive-goal"],
      forbiddenEventPattern: ORDINARY_ENGINEERING_NO_ADAPTIVE_DELIVERY_PATTERN,
    },
  ],
  [
    TICKET_PRE_RUN_PATTERN,
    {
      kind: "inactive-controls",
      forbiddenSkills: [
        "read-ticket",
        "assess-implementation-readiness",
        "prepare-task-branch",
      ],
      forbiddenEventPattern: TICKET_PRE_RUN_PATTERN,
    },
  ],
  [
    TICKET_UNAVAILABLE_PATTERN,
    {
      kind: "inactive-controls",
      forbiddenSkills: [
        "read-ticket",
        "assess-implementation-readiness",
        "prepare-task-branch",
      ],
      forbiddenEventPattern: TICKET_UNAVAILABLE_PATTERN,
      forbidSpawn: true,
      forbidAgentTool: true,
    },
  ],
  [
    READINESS_AFTER_CONTINUATION_PATTERN,
    {
      kind: "skill-absent-after-continuation",
      skill: "assess-implementation-readiness",
    },
  ],
  [
    TICKET_REINVOKED_AFTER_CONTINUATION_PATTERN,
    {
      kind: "skill-absent-after-continuation",
      skill: "ticket-to-pr",
      forbidNativeSkillCall: true,
    },
  ],
  [
    PR_EVIDENCE_INACTIVE_PATTERN,
    { kind: "skills-inactive", forbiddenSkills: ["publish-pr-evidence"] },
  ],
  [
    TICKET_RECIPE_INACTIVE_PATTERN,
    {
      kind: "skills-inactive",
      forbiddenSkills: ["ticket-to-pr", "adaptive-goal"],
      forbidSpawn: true,
    },
  ],
]);

function readerTranscriptSelection(pattern: unknown) {
  if (pattern === FRESH_PROVIDER_CONTEXT_PATTERN)
    return { kind: "fresh-provider-context" };
  if (pattern === ACCEPTED_CHILD_SESSION_PATTERN)
    return { kind: "accepted-child-session" };
  if (pattern === "inspect-candidate")
    return { kind: "event-term", term: "inspect-candidate" };
  return null;
}

function ticketTranscriptSelection(pattern: unknown) {
  if (pattern === ADAPTIVE_SUPPORTING_READ_PATTERN)
    return { kind: "supporting-skill-read", skill: "adaptive-goal" };
  const publisher = PUBLISHER_READ_PATTERNS.get(pattern as string);
  if (publisher) return { kind: "bound-child-skill", skill: publisher };
  return null;
}

function continuationTranscriptSelection(pattern: unknown) {
  if (CONTINUATION_BOUNDARY_PATTERNS.has(pattern as string))
    return { kind: "continuation-boundary" };
  if (
    CONTINUATION_UNCHANGED_PATTERNS.has(pattern as string) ||
    pattern === CROSS_TURN_UNCHANGED_PATTERN
  )
    return { kind: "unchanged-before-continuation" };
  if (pattern === CROSS_TURN_OWNER_BEFORE_PATTERN)
    return { kind: "owner-before-continuation" };
  if (pattern === OWNER_AFTER_CONTINUATION_PATTERN)
    return { kind: "owner-after-continuation" };
  return null;
}

function expectedTranscriptSelection(pattern: unknown) {
  const reader =
    readerTranscriptSelection(pattern) ??
    ticketTranscriptSelection(pattern) ??
    continuationTranscriptSelection(pattern);
  if (reader) return reader;
  const route = OWNER_ROUTE_PATTERNS.get(pattern as string);
  if (route) return { kind: "owner-route", ...route };
  if (ONE_OWNER_TRANSCRIPT_PATTERNS.has(pattern as string))
    return { kind: "one-owner-accepted" };
  if (pattern === READINESS_BEFORE_CONTINUATION_PATTERN)
    return {
      kind: "skill-before-continuation",
      skill: "assess-implementation-readiness",
    };
  if (pattern === READINESS_PRE_OWNER_PATTERN)
    return {
      kind: "pre-owner-skill-read",
      skill: "assess-implementation-readiness",
    };
  if (pattern === NONREADY_SKILL_READ_PATTERN)
    return {
      kind: "parent-skill-read-count",
      skill: "assess-implementation-readiness",
      min: 1,
    };
  const responseRequired = SAME_OWNER_FEEDBACK_PATTERNS.get(pattern as string);
  if (responseRequired !== undefined)
    return { kind: "same-owner-feedback", responseRequired };
  return null;
}

function nestedReaderSelection(check: RecordValue, id: string, name: string) {
  if (check.not_regex !== NO_INHERITED_READER_CONTEXT_PATTERN) return null;
  const axes =
    check.expect_regex === SPEC_NESTED_READER_PATTERN
      ? ["spec"]
      : check.expect_regex === DUAL_NESTED_READER_PATTERN
        ? ["standards", "spec"]
        : null;
  return axes ? { id, name, kind: "nested-readers", axes } : null;
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
    const nested = nestedReaderSelection(check, id, name);
    if (nested) return nested;
    const selection = expectedTranscriptSelection(check.expect_regex);
    if (selection && check.not_regex === undefined)
      return { id, name, ...selection };
    throw new Error(
      `transcript check ${index + 1} has no Sevro evidence mapping`,
    );
  }
  const specialKind = SPECIAL_NEGATIVE_TRANSCRIPT_KINDS.get(
    check.not_regex as string,
  );
  if (specialKind) return { id, name, ...specialKind };
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
    !skillDir?.endsWith("/adaptive-goal") &&
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
    selected.adaptive_goal_composition !== undefined &&
    typeof selected.adaptive_goal_composition !== "boolean"
  )
    throw new Error("adaptive delivery composition must be a boolean");
  if (selected.adaptive_goal_composition !== true) return null;
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
    !skillDir?.endsWith("/adaptive-goal") ||
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

const TRANSCRIPT_EVIDENCE = new Map([
  ["guide-no-owner-or-goal-control", ["sevro.host.native-controls"]],
  ["no-agent-spawn", ["sevro.codex.native-calls"]],
  ["one-owner-accepted", ["sevro.codex.native-calls"]],
  ["owner-route", ["sevro.codex.native-calls"]],
  ["nested-readers", ["sevro.codex.native-calls"]],
  ["fresh-provider-context", ["sevro.codex.native-calls"]],
  ["accepted-child-session", ["sevro.codex.native-calls"]],
  ["event-term", ["sevro.codex.events"]],
  ["supporting-skill-read", ["sevro.codex.skill-reads"]],
  ["bound-child-skill", ["sevro.codex.native-calls"]],
  ["no-parent-work-after-handoff", ["sevro.codex.native-calls"]],
  ["no-lifecycle-ledger", ["sevro.codex.native-calls", "sevro.codex.events"]],
  ["owner-after-continuation", ["sevro.codex.native-calls"]],
  ["owner-before-continuation", ["sevro.codex.native-calls"]],
  ["no-owner-before-continuation", ["sevro.codex.native-calls"]],
  [
    "no-replacement-after-continuation",
    ["sevro.codex.native-calls", "sevro.codex.follow-up-events"],
  ],
  ["no-native-goal-control", ["sevro.codex.native-calls"]],
  ["no-owner-or-goal-control", ["sevro.codex.native-calls"]],
  ["skills-inactive", ["sevro.codex.native-calls", "sevro.codex.skill-reads"]],
  ["same-owner-feedback", ["sevro.codex.native-calls"]],
  ["pre-owner-skill-read", ["sevro.codex.native-calls"]],
  ["parent-skill-read-count", ["sevro.codex.native-calls"]],
  ["no-plaintext-feedback-mismatch", ["sevro.codex.native-calls"]],
  ["no-second-owner", ["sevro.codex.native-calls"]],
  ["skill-before-continuation", ["sevro.codex.initial-skill-reads"]],
  ["skill-absent-after-continuation", ["sevro.codex.follow-up-skill-reads"]],
]);

function inactiveControlEvidence(check: RecordValue): string[] {
  if (check.kind !== "inactive-controls") return [];
  return [
    ...(Array.isArray(check.forbiddenSkills) && check.forbiddenSkills.length
      ? ["sevro.codex.skill-reads"]
      : []),
    ...((Array.isArray(check.forbiddenEventTerms) &&
      check.forbiddenEventTerms.length) ||
    typeof check.forbiddenEventPattern === "string"
      ? ["sevro.codex.events"]
      : []),
    ...(check.forbidSpawn === true || check.forbidAgentTool === true
      ? ["sevro.codex.native-calls"]
      : []),
  ];
}

function transcriptEvidence(check: RecordValue): string[] {
  return [
    ...(TRANSCRIPT_EVIDENCE.get(String(check.kind)) ?? []),
    ...inactiveControlEvidence(check),
    ...(check.kind === "skill-absent-after-continuation" &&
    check.forbidNativeSkillCall === true
      ? ["sevro.codex.native-calls"]
      : []),
  ];
}

function policyEvidence(
  ownership: ReturnType<typeof caseOwnership>,
  transcriptChecks: ReturnType<typeof caseTranscriptChecks>,
) {
  const required = new Set(ownership?.requiredEvidence ?? []);
  for (const check of transcriptChecks ?? []) {
    for (const id of transcriptEvidence(check)) required.add(id);
  }
  return [...required];
}

function claudeReadinessCasePolicy(transcript: unknown) {
  if (
    createHash("sha256").update(JSON.stringify(transcript)).digest("hex") !==
    "7c4119bd1185600c9bf6fa6d578936cc956f1cf151beec1807c73577a7286bd7"
  )
    throw new Error("Claude readiness transcript policy has changed");
  const checks = (transcript as RecordValue[]).map((entry, index) => ({
    id: `darrow.evals.transcript.${index + 1}`,
    name: string(entry.name, "Claude transcript check name"),
    kind: [
      "claude-readiness-once",
      "claude-readiness-no-retry",
      "claude-no-owner",
      "claude-no-ledger",
    ][index]!,
  }));
  return {
    checks: [
      ...OWNERSHIP_CHECKS.map((id) => ({
        id,
        grader: "darrow.evals.ownership",
        configuration: {},
      })),
      ...checks.map(({ id }) => ({
        id,
        grader: "darrow.evals.transcript",
        configuration: {},
      })),
    ],
    requiredEvidence: ["sevro.claude.tool-calls", "sevro.claude.events"],
    details: { ownership: "claude", transcriptChecks: checks },
  };
}

function claudeSelectedOwnerCasePolicy(transcript: unknown) {
  if (
    createHash("sha256").update(JSON.stringify(transcript)).digest("hex") !==
    "60cd2a65222d3e639098086d2563a2a681a690e30cb9dcc20800be0eddad1c0c"
  )
    throw new Error("Claude selected-owner transcript policy has changed");
  const kinds = [
    "claude-selected-owner",
    "claude-one-owner",
    "claude-independent-review",
    "claude-selected-route",
    "claude-no-ledger",
  ];
  const checks = (transcript as RecordValue[]).map((entry, index) => ({
    id: `darrow.evals.transcript.${index + 1}`,
    name: string(entry.name, "Claude transcript check name"),
    kind: kinds[index]!,
  }));
  return {
    checks: [
      ...OWNERSHIP_CHECKS.map((id) => ({
        id,
        grader: "darrow.evals.ownership",
        configuration: {},
      })),
      ...checks.map(({ id }) => ({
        id,
        grader: "darrow.evals.transcript",
        configuration: {},
      })),
    ],
    requiredEvidence: [
      "sevro.claude.tool-calls",
      "sevro.claude.events",
      "sevro.claude.nested-skills",
    ],
    details: { ownership: "claude-selected", transcriptChecks: checks },
  };
}

function guideTranscriptChecks(value: unknown, skillDir: string | null) {
  const checks = caseTranscriptChecks(value);
  if (skillDir !== ".agents/skills/darrow-guide") return checks;
  return (
    checks?.map((check) =>
      check.kind === "no-owner-or-goal-control"
        ? { ...check, kind: "guide-no-owner-or-goal-control" }
        : check,
    ) ?? null
  );
}

function casePolicy(selected: RecordValue, skillDir: string | null) {
  return selected.native_goal === undefined
    ? legacyCasePolicy(selected, skillDir)
    : nativeGoalCasePolicy(selected);
}

function currentTranscriptSelection(value: unknown) {
  const current: NativeTranscript[] = [];
  const legacy: ReturnType<typeof caseTranscriptCheck>[] = [];
  if (value === undefined) return { current, legacy };
  if (!Array.isArray(value))
    throw new Error("transcript checks must be an array");
  for (const [index, entry] of value.entries()) {
    try {
      current.push({
        ...nativeTranscriptPolicy([entry])[0]!,
        id: `darrow.evals.transcript.${index + 1}`,
      });
    } catch {
      legacy.push(caseTranscriptCheck(entry, index));
    }
  }
  return { current, legacy };
}

function nativeGoalCasePolicy(selected: RecordValue) {
  const policy = nativeGoalPolicy(selected.native_goal);
  const transcriptChecks = currentTranscriptSelection(
    selected.transcript_checks,
  );
  return {
    checks: [
      ...policy.checks,
      ...[...transcriptChecks.current, ...transcriptChecks.legacy].map(
        ({ id }) => ({
          id,
          grader: "darrow.evals.transcript",
          configuration: {},
        }),
      ),
    ],
    requiredEvidence: [
      ...new Set([
        ...policy.requiredEvidence,
        "sevro.host.native-controls",
        ...nativeTranscriptEvidence(transcriptChecks.current),
        ...policyEvidence(null, transcriptChecks.legacy),
      ]),
    ],
    details: {
      ...policy.details,
      ...(transcriptChecks.current.length
        ? { nativeTranscriptChecks: transcriptChecks.current }
        : {}),
      ...(transcriptChecks.legacy.length
        ? { transcriptChecks: transcriptChecks.legacy }
        : {}),
    },
  };
}

function legacyCasePolicy(selected: RecordValue, skillDir: string | null) {
  if (selected.id === "claude-readiness-nonready-stops")
    return claudeReadinessCasePolicy(selected.transcript_checks);
  if (selected.id === "goal-review-high-selected-claude")
    return claudeSelectedOwnerCasePolicy(selected.transcript_checks);
  const ownership = caseOwnership(selected, skillDir);
  const transcriptChecks = guideTranscriptChecks(
    selected.transcript_checks,
    skillDir,
  );
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
    ...shellChecks(selected.checks, skillDir),
    ...headChecks(selected.expect_head_change),
    ...(await outputChecks(selected.output_checks, root, skillDir)),
    ...semanticOutputChecks(selected.semantic_output_checks),
    ...semanticArtifactChecks(selected.semantic_artifact),
  ];
}

async function casePrompts(
  selected: RecordValue,
  root: string,
  skillDir: string | null,
  deferRoute = false,
) {
  const invocation = await invocationForCase(
    root,
    skillDir,
    `${string(selected.prompt, "case prompt")}\n${selected.follow_up_prompt ?? ""}`,
  );
  const token = invocation ? "{{sevro.skill_invocation}}" : null;
  return {
    invocation,
    prompt: casePrompt(selected.prompt, token, deferRoute),
    ...(selected.follow_up_prompt === undefined
      ? {}
      : {
          followUpPrompt: casePrompt(
            selected.follow_up_prompt,
            token,
            deferRoute,
          ),
        }),
  };
}

function caseDefinition(value: unknown): RecordValue {
  const selected = record(value, "case");
  keys(selected, CASE_FIELDS, "case");
  return selected;
}

function disclosureDetails(checks: { id: string; grader: string }[]) {
  const ids = checks
    .filter((check) => check.grader === "darrow.evals.disclosure")
    .map((check) => check.id);
  return ids.length ? { disclosureChecks: ids } : {};
}

function caseMetricDetails(selected: RecordValue) {
  const checkMetrics = caseCheckMetrics(selected);
  return checkMetrics.length ? { checkMetrics } : {};
}

async function caseAssessment(
  selected: RecordValue,
  root: string,
  skillDir: string | null,
  configuration: SkillMountConfiguration & BenchmarkPolicyConfiguration,
) {
  const policy = casePolicy(selected, skillDir);
  const benchmark = benchmarkCasePolicy(
    configuration,
    configuration.skillDir ?? skillDir,
  );
  return {
    policy: {
      ...policy,
      requiredEvidence: [
        ...new Set([...policy.requiredEvidence, ...benchmark.requiredEvidence]),
      ],
      details: { ...policy.details, ...benchmark.details },
    },
    checks: [
      ...(await caseChecks(selected, root, skillDir)),
      ...policy.checks,
      ...benchmark.checks,
    ],
  };
}

type CaseConfiguration = SkillMountConfiguration &
  BenchmarkPolicyConfiguration & { deferRoute?: boolean };

async function neutralCase(
  value: unknown,
  source: string,
  root: string,
  options: CaseConfiguration = {},
) {
  const selected = caseDefinition(value);
  const { fixture, ...setup } = caseFixture(selected.fixture);
  if (options.skillDir)
    await loadSkillOverride(root, join(root, options.skillDir));
  const { skillDir, mountPluginSkills, ...mount } = caseMount(
    selected.mount_plugin_skills,
    source,
    root,
    options,
  );
  const additionalMounts = caseAdditionalMounts(selected, skillDir);
  const { invocation, prompt, ...followUp } = await casePrompts(
    selected,
    root,
    skillDir,
    options.deferRoute,
  );
  const { policy, checks } = await caseAssessment(
    selected,
    root,
    skillDirForSource(source),
    options,
  );
  return {
    id: string(selected.id, "case ID"),
    prompt,
    ...followUp,
    fixture,
    checks,
    requiredEvidence: policy.requiredEvidence,
    extensionData: {
      "darrow.case": {
        ...caseFacts(selected, source, mountPluginSkills),
        projectRoot: pathToFileURL(root).href,
        ...setup,
        ...mount,
        ...additionalMounts,
        ...(invocation ? { invocation } : {}),
        ...policy.details,
        ...disclosureDetails(checks),
      },
    },
  };
}

function caseFacts(
  selected: RecordValue,
  source: string,
  mountPluginSkills: boolean,
) {
  const hostIds = caseHostIds(selected.harnesses);
  return {
    invariant: string(selected.invariant, "case invariant"),
    ...(hostIds ? { hostIds } : {}),
    source,
    ...caseActivation(selected, skillDirForSource(source), mountPluginSkills),
    checkNames: checkNames(selected),
    ...caseMetricDetails(selected),
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

async function skillMountSource(details: RecordValue, configuration: unknown) {
  const mount = record(details.mount, "skill mount");
  const rootUrl = string(mount.projectRoot, "mount project root");
  if (!rootUrl.startsWith("file:///"))
    throw new Error("mount project root must be a file URL");
  const root = await realpath(fileURLToPath(rootUrl));
  const skillDir = string(mount.skillDir, "mount skill directory");
  if (
    skillDir !==
    (extensionConfiguration(configuration).skillDir ??
      skillDirForSource(string(details.source, "case source")))
  )
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

async function projectSkillArtifacts(
  sources: { skillRoot: string; skillName: string }[],
  ownerSkillRoot: string | undefined,
) {
  const artifacts = await skillArtifacts(sources);
  if (!ownerSkillRoot) return artifacts;
  const pluginRoot = dirname(dirname(ownerSkillRoot));
  const total = {
    bytes: artifacts.reduce(
      (size, artifact) =>
        size + Buffer.from(artifact.contentBase64, "base64").byteLength,
      0,
    ),
  };
  for (const name of ["backend", "references"]) {
    const directory = join(pluginRoot, name);
    if (await optionalPluginDirectory(directory))
      await collectPluginDirectory(pluginRoot, directory, [name], {
        artifacts,
        total,
        destination: ".agents",
      });
  }
  return artifacts;
}

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
    "references",
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

async function owningPluginPackage(
  sources: { skillRoot: string; skillName: string }[],
  ownerName: string | null,
) {
  if (ownerName === null) return [];
  const pluginRoot = dirname(dirname(sources[0]!.skillRoot));
  if (
    sources.some((source) => dirname(dirname(source.skillRoot)) !== pluginRoot)
  )
    throw new Error("plugin package mixes source roots");
  if ((await pluginName(pluginRoot)) !== ownerName)
    throw new Error("Codex plugin name changed after resolution");
  return [{ pluginRoot, name: ownerName, sources, destination: "plugin" }];
}

async function codexPluginArtifacts(
  sources: { skillRoot: string; skillName: string }[],
  ownerName: string | null,
  additional: Awaited<ReturnType<typeof additionalPluginSources>> = [],
  artifacts: SkillArtifact[] = [],
): Promise<SkillArtifact[]> {
  const packages = [
    ...(await owningPluginPackage(sources, ownerName)),
    ...additional.map((item, index) => ({
      ...item,
      destination: `plugins/${index}-${item.name}`,
    })),
  ];
  if (new Set(packages.map((item) => item.name)).size !== packages.length)
    throw new Error("Codex marketplace plugin names must be unique");
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
    return {
      command: ["/bin/bash", "-c", "mkdir -p .git/fixture-state"],
      environment: {},
    };
  const { fixture, source } = await readBoundCase(details, caseId);
  const { script, ticket } = verifyFixturePreparation(details, fixture);
  return {
    command: [
      "/bin/bash",
      "-c",
      [
        'case "${PATH%%:*}" in */.git/fixture-bin) PATH=${PATH#*:}; export PATH ;; esac',
        "mkdir -p .git/fixture-state",
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

function hostSupportsInvocation(hostValue: unknown): boolean {
  const host = record(hostValue, "candidate host");
  const capabilities = Array.isArray(host.capabilities)
    ? host.capabilities
    : [];
  const codex =
    host.id === "sevro.host.codex" &&
    capabilities.includes("sevro.codex.plugin-marketplace") &&
    capabilities.includes("sevro.codex.explicit-invocation");
  const claude =
    host.id === "sevro.host.claude" &&
    capabilities.includes("sevro.claude.plugin-dirs") &&
    capabilities.includes("sevro.claude.explicit-invocation");
  return codex || claude;
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
  if (!hostSupportsInvocation(hostValue))
    throw new Error("skill invocation requires a capable plugin host");
  if (!sources.some((source) => source.skillName === invocation.skillName))
    throw new Error("invoked skill is absent from the package");
  return {
    pluginName: string(invocation.pluginName, "plugin name"),
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
    host.id === "sevro.host.codex" && (hasInvocation || hasAdditional);
  if (
    selected &&
    (!Array.isArray(host.capabilities) ||
      !host.capabilities.includes("sevro.codex.plugin-marketplace"))
  )
    throw new Error("additional plugins require the Codex plugin host");
  return selected;
}

function claudePackageHost(hostValue: unknown, hasOwner: boolean): boolean {
  const host = record(hostValue, "candidate host");
  if (host.id !== "sevro.host.claude" || !hasOwner) return false;
  if (
    !Array.isArray(host.capabilities) ||
    !host.capabilities.includes("sevro.claude.plugin-dirs")
  )
    throw new Error("Claude plugin package requires the Claude plugin host");
  return true;
}

function packageDeclarations(options: {
  codexPackages: boolean;
  claudePackages: boolean;
  ownerName: string | null;
  additional: Awaited<ReturnType<typeof additionalPluginSources>>;
  invocation: ReturnType<typeof requiredInvocation>;
}) {
  const { codexPackages, claudePackages, ownerName, additional, invocation } =
    options;
  return {
    ...(codexPackages
      ? {
          codexMarketplace: {
            artifactRoot: MARKETPLACE_ROOT,
            marketplaceName: "darrow-eval",
            pluginNames: [
              ...(ownerName ? [ownerName] : []),
              ...additional.map((item) => item.name),
            ],
          },
          ...(invocation ? { codexSkillInvocation: invocation } : {}),
        }
      : {}),
    ...(claudePackages
      ? {
          claudePluginDirs: {
            artifactRoots: [
              ...(ownerName ? [`${MARKETPLACE_ROOT}/plugin`] : []),
              ...additional.map(
                (item, index) =>
                  `${MARKETPLACE_ROOT}/plugins/${index}-${item.name}`,
              ),
            ],
          },
          ...(invocation ? { claudeSkillInvocation: invocation } : {}),
        }
      : {}),
  };
}

function repositoryInvocation(details: RecordValue, hostValue: unknown) {
  if (details.invocation === undefined) return {};
  const invocation = record(details.invocation, "repository skill invocation");
  const host = record(hostValue, "candidate host");
  const claude = host.id === "sevro.host.claude";
  const capability = claude
    ? "sevro.claude.repository-invocation"
    : "sevro.codex.repository-invocation";
  if (
    !["sevro.host.codex", "sevro.host.claude"].includes(String(host.id)) ||
    !Array.isArray(host.capabilities) ||
    !host.capabilities.includes(capability)
  )
    throw new Error(
      "repository skill invocation requires a capable native host",
    );
  if (invocation.scope !== "repository")
    throw new Error("repository skill invocation has an invalid scope");
  const declaration = {
    skillName: string(invocation.skillName, "invoked repository skill"),
  };
  return claude
    ? { claudeRepositorySkillInvocation: declaration }
    : { codexRepositorySkillInvocation: declaration };
}

async function claudeRepositorySources(
  details: RecordValue,
  sources: { skillRoot: string; skillName: string }[],
) {
  const root = await realpath(
    fileURLToPath(string(details.projectRoot, "case project root")),
  );
  return Promise.all(
    sources.map(async ({ skillName }) => {
      const path = join(root, ".claude/skills", skillName);
      const entry = await lstat(path).catch(() => null);
      if (!entry?.isDirectory() || entry.isSymbolicLink())
        throw new Error("Claude repository skill mirror is missing or unsafe");
      const skillRoot = await realpath(path);
      if (!within(root, skillRoot))
        throw new Error(
          "Claude repository skill mirror escapes the project root",
        );
      return { skillRoot, skillName };
    }),
  );
}

async function repositoryArtifacts(
  owner: { skillRoot: string; skillName: string }[],
  additional: Awaited<ReturnType<typeof additionalPluginSources>>,
  options: { packaged: boolean; destination: string },
) {
  if (options.packaged)
    return codexPluginArtifacts(
      [],
      null,
      additional,
      await skillArtifacts(owner, options.destination),
    );
  return skillArtifacts(
    [...owner, ...additional.flatMap((item) => item.sources)],
    options.destination,
  );
}

function claudeRepositoryHost(hostValue: unknown) {
  const host = record(hostValue, "candidate host");
  if (host.id !== "sevro.host.claude") return false;
  if (
    !Array.isArray(host.capabilities) ||
    !host.capabilities.includes("sevro.claude.repository-invocation")
  )
    throw new Error(
      "Claude repository skills require --claude-project-settings",
    );
  return true;
}

async function repositorySkillMounts(
  details: RecordValue,
  sources: { skillRoot: string; skillName: string }[],
  hostValue: unknown,
) {
  const claude = claudeRepositoryHost(hostValue);
  const { owner, additional } = mergeAdditionalSkills(
    claude ? await claudeRepositorySources(details, sources) : sources,
    await additionalPluginSources(details),
    await additionalSkillSources(details),
  );
  const mounted = [...owner, ...additional.flatMap((item) => item.sources)];
  if (new Set(mounted.map((item) => item.skillName)).size !== mounted.length)
    throw new Error("mounted skill names must be unique");
  requireActivationSkills(details, mounted);
  const codexPackages = codexPackageHost(
    hostValue,
    additional.length > 0,
    false,
  );
  const claudePackages = claudePackageHost(hostValue, additional.length > 0);
  return {
    artifacts: await repositoryArtifacts(owner, additional, {
      packaged: codexPackages || claudePackages,
      destination: claude ? ".claude/skills" : ".agents/skills",
    }),
    ...packageDeclarations({
      codexPackages,
      claudePackages,
      ownerName: null,
      additional,
      invocation: null,
    }),
    ...repositoryInvocation(details, hostValue),
  };
}

async function preparedMounts(
  details: RecordValue,
  hostValue: unknown,
  configuration: unknown,
) {
  const sources =
    details.mount === undefined
      ? []
      : await skillMountSource(details, configuration);
  if (repositoryMount(details))
    return repositorySkillMounts(details, sources, hostValue);
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
  const codexPackages = codexPackageHost(
    hostValue,
    additional.length > 0,
    invocation !== null,
  );
  const claudePackages = claudePackageHost(hostValue, owner.length > 0);
  const packagePlugins = codexPackages || claudePackages;
  const ownerName = packagePlugins
    ? (invocation?.pluginName ??
      (await pluginName(dirname(dirname(owner[0]!.skillRoot)))))
    : null;
  const artifacts = packagePlugins
    ? await codexPluginArtifacts(owner, ownerName!, additional)
    : await projectSkillArtifacts(mounted, owner[0]?.skillRoot);
  return {
    artifacts,
    ...packageDeclarations({
      codexPackages,
      claudePackages,
      ownerName,
      additional,
      invocation,
    }),
  };
}

function repositoryMount(details: RecordValue) {
  return (
    details.mount !== undefined &&
    string(
      record(details.mount, "skill mount").skillDir,
      "skill directory",
    ).startsWith(".agents/")
  );
}

function withoutSkill(configuration: unknown): boolean {
  return extensionConfiguration(configuration).withoutSkill;
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

function requiredNativeRoute(details: RecordValue) {
  const portable =
    details.ownership === undefined &&
    Array.isArray(details.transcriptChecks) &&
    details.transcriptChecks.length > 0 &&
    details.transcriptChecks.every(
      (check) =>
        activationData(check)?.kind === "guide-no-owner-or-goal-control",
    );
  if (portable)
    return {
      ids: ["sevro.host.codex", "sevro.host.claude"],
      capability: "sevro.host.native-controls",
    };
  const claude =
    details.ownership === "claude" || details.ownership === "claude-selected";
  return {
    ids: [claude ? "sevro.host.claude" : "sevro.host.codex"],
    capability: claude ? "sevro.claude.tool-calls" : "sevro.codex.native-calls",
  };
}

function requireNativeEvidence(details: RecordValue, hostValue: unknown) {
  if (details.ownership === undefined && details.transcriptChecks === undefined)
    return;
  const host = record(hostValue, "candidate host");
  const { ids, capability } = requiredNativeRoute(details);
  if (
    !ids.includes(String(host.id)) ||
    !Array.isArray(host.capabilities) ||
    !host.capabilities.includes(capability)
  )
    throw new Error(
      capability === "sevro.host.native-controls"
        ? "native checks require native control evidence"
        : capability === "sevro.claude.tool-calls"
          ? "native checks require Claude tool-call evidence"
          : "native checks require Codex native-call evidence",
    );
}

async function prepareCase(params: RecordValue) {
  const selected = record(params.case, "prepared case");
  const data = record(selected.extensionData, "case extension data");
  const details = record(data["darrow.case"], "Darrow case data");
  requireMountConfiguration(details, params.configuration);
  requireCaseHost(details.hostIds, params.host);
  requireBenchmarkOwnerHost(details, params.host);
  const omitSkills = withoutSkill(params.configuration);
  if (omitSkills && details.invocation !== undefined)
    throw new Error("explicit skill invocation cannot run without skills");
  requireNativeEvidence(details, params.host);
  const setup = await caseSetup(details, string(selected.id, "case ID"));
  return {
    ...(omitSkills
      ? { artifacts: [] }
      : await preparedMounts(details, params.host, params.configuration)),
    requestedInstrumentation: [],
    ...(setup ? { fixtureSetup: setup } : {}),
    extensionData: {},
  };
}

function requireBenchmarkOwnerHost(details: RecordValue, value: unknown) {
  if (details.benchmarkOwnerRoute === undefined) return;
  const host = record(value, "candidate host");
  if (
    host.id !== "sevro.host.codex" ||
    !Array.isArray(host.capabilities) ||
    !host.capabilities.includes("sevro.codex.native-calls")
  )
    throw new Error(
      "native effective owner routes require Codex native-call evidence",
    );
}

function requireMountConfiguration(details: RecordValue, value: unknown) {
  const configuration = skillMountConfiguration(extensionConfiguration(value));
  const mount =
    details.mount === undefined ? {} : record(details.mount, "skill mount");
  if (!isDeepStrictEqual(mount.configuration ?? {}, configuration))
    throw new Error("skill mount differs from preparation configuration");
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
    ".agents/skills/*/evals/*.yaml",
  ]) {
    const glob = new Bun.Glob(pattern);
    for await (const source of glob.scan({ cwd: root, dot: true })) {
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

type RunOwnership = { skill?: string; plugin?: string };

function validateRunSelectors(filters: string[], ownership: RunOwnership) {
  if (
    filters.some((filter) => !filter.trim()) ||
    Object.values(ownership).some(
      (value) => value !== undefined && !value.trim(),
    )
  )
    throw new Error("selection needs nonempty selectors");
}

function matchesRunOwnership(source: string, ownership: RunOwnership) {
  const owner = skillDirForSource(source);
  if (
    ownership.skill !== undefined &&
    owner?.split("/").at(-1) !== ownership.skill
  )
    return false;
  const plugin = owner?.startsWith("plugins/")
    ? owner.split("/")[2]
    : undefined;
  return ownership.plugin === undefined || plugin === ownership.plugin;
}

/** Apply the direct runner's ownership and case filters before resolution. */
export async function selectRunCaseIds(
  root: string,
  filters: string[],
  ownership: RunOwnership,
) {
  validateRunSelectors(filters, ownership);
  const projectRoot = await realpath(root);
  const ids = new Set<string>();
  const selected: string[] = [];
  for (const entry of await caseEntries(projectRoot)) {
    const id = string(record(entry.value, "case").id, "case ID");
    if (ids.has(id)) throw new Error(`duplicate case ID: ${id}`);
    ids.add(id);
    if (!matchesRunOwnership(entry.source, ownership)) continue;
    if (!filters.length || filters.some((filter) => id.includes(filter)))
      selected.push(id);
  }
  if (!selected.length) throw new Error("No cases matched.");
  return selected.sort();
}

/** Validate every canonical Darrow case against the current extension. */
export async function validateCaseInventory(root: string) {
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
    format: "darrow-case-inventory-v1",
    projectRoot,
    total: entries.length,
    supported,
    failures: failures.sort((left, right) =>
      left.source.localeCompare(right.source),
    ),
    valid: failures.length === 0,
  };
}

async function selectedCase(params: RecordValue) {
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
  return { ...matches[0]!, root };
}

export async function selectedCaseFixture(params: RecordValue) {
  const selected = await selectedCase(params);
  return caseFixture(caseDefinition(selected.value).fixture).fixture;
}

/** Validate a suite input's templates and return policy facts, without a host route. */
export async function preflightCaseDetails(params: RecordValue) {
  const selected = await selectedCase(params);
  const configuration = extensionConfiguration(params.configuration);
  const condition = configuration.benchmarkCondition;
  const resolved = await neutralCase(
    caseWithCondition(selected.value, condition),
    selected.source,
    selected.root,
    { ...configuration, deferRoute: condition !== undefined },
  );
  return resolved.extensionData["darrow.case"];
}

export async function resolveCase(params: RecordValue) {
  const selected = await selectedCase(params);
  return {
    cases: [
      await neutralCase(
        conditionedCase(
          selected.value,
          extensionConfiguration(params.configuration).benchmarkCondition,
          params.host,
        ),
        selected.source,
        selected.root,
        extensionConfiguration(params.configuration),
      ),
    ],
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
        ? [
            "sevro.codex.explicit-invocation",
            "sevro.claude.repository-invocation",
          ].includes(item.id)
        : item.id === "darrow.activation" ||
          item.id === "sevro.codex.skill-reads" ||
          item.id === "sevro.claude.tool-calls"),
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

function supportedExplicitActivation(
  observation: RecordValue,
  data: RecordValue,
) {
  if (observation.id === "sevro.claude.repository-invocation")
    return (
      observation.source === "sevro.host.claude" &&
      data.method === "native_repository_command" &&
      data.accepted === true
    );
  return (
    observation.id === "sevro.codex.explicit-invocation" &&
    observation.source === "sevro.host.codex" &&
    data.method === "explicit_invocation"
  );
}

function supportedActivationSource(
  observation: RecordValue,
  data: RecordValue,
  explicit: boolean,
): boolean {
  if (explicit) return supportedExplicitActivation(observation, data);
  if (observation.id === "darrow.activation") return true;
  if (observation.id === "sevro.claude.tool-calls")
    return (
      observation.source === "sevro.host.claude" &&
      data.method === "stream_tool_calls"
    );
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

function implicitClaudeActivation(
  selected: RecordValue,
  observations: unknown,
  details: RecordValue,
): RecordValue {
  const calls = claudeCalls(observations);
  if (!calls) return { ...selected, completeness: "partial" };
  const target = activationExpectation(details.activation).targetSkill;
  const skills = calls.filter((call) => call.name === "Skill");
  const repository = String(details.source).startsWith(".agents/");
  const foreignOwner =
    repository &&
    skills.some((call) => call.skill === target && call.invocation !== target);
  const observedSkills = [...new Set(skills.map((call) => String(call.skill)))];
  return {
    ...selected,
    completeness: foreignOwner ? "partial" : "complete",
    data: {
      ...record(selected.data, "Claude calls"),
      primarySkill: observedSkills[0] ?? null,
      observedSkills,
    },
  };
}

function caseActivationObservation(
  observations: unknown,
  details: RecordValue,
) {
  const explicit = details.invocation !== undefined;
  const selected = activationObservation(observations, explicit);
  if (!selected) return null;
  if (selected.id === "sevro.claude.repository-invocation") {
    const invocation = record(details.invocation, "repository invocation");
    const data = activationData(selected.data);
    return invocation.scope === "repository" &&
      data?.skill === invocation.skillName
      ? selected
      : null;
  }
  if (selected.id !== "sevro.claude.tool-calls") return selected;
  return implicitClaudeActivation(selected, observations, details);
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

const FEEDBACK_TOOLS = new Set([
  "followup_task",
  "send_message",
  "interrupt_agent",
]);
const FEEDBACK_TARGET =
  /^(?:\/root(?:\/[a-z0-9_]+)+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9][a-z0-9_]{0,63})$/;

function nativeFeedbackEvidence(observations: unknown) {
  const ownership = nativeOwnershipEvidence(observations);
  const observation = uniqueObservation(
    observations,
    "sevro.codex.native-calls",
  );
  const data = observation ? activationData(observation.data) : null;
  if (!ownership || !Array.isArray(data?.feedbackCalls)) return null;
  const feedback = data.feedbackCalls.map(activationData);
  if (feedback.some((entry) => !entry)) return null;
  const calls = feedback as RecordValue[];
  const tools = ownership.calls.filter(
    (call) =>
      call.namespace === "collaboration" &&
      FEEDBACK_TOOLS.has(String(call.name)),
  );
  if (
    calls.length !== tools.length ||
    calls.some((call, index) => {
      const tool = tools[index]!;
      return (
        call.ordinal !== tool.ordinal ||
        call.tool !== tool.name ||
        (call.target !== null &&
          (typeof call.target !== "string" ||
            !FEEDBACK_TARGET.test(call.target))) ||
        (call.target ?? undefined) !== tool.target ||
        typeof call.responseObserved !== "boolean"
      );
    })
  )
    return null;
  return { feedback: calls, spawns: ownership.spawns };
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

function internalRecordCheck(observations: unknown, host = "sevro.host.codex") {
  const final = uniqueObservation(
    observations,
    "sevro.observation.final-message",
  );
  const text = final ? activationData(final.data)?.text : undefined;
  const available =
    final?.source === host &&
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
    attemptedSkillTool: evidence.calls.some((call) => call.name === "Skill"),
    spawnCount: controlOrdinals(calls, "collaboration", "spawn_agent").length,
    acceptedSpawnCount: evidence.spawns.length,
    acceptedSpawns: evidence.spawns,
    toolCalls: evidence.calls,
  };
}

function validParentReadCounts(diagnostic: RecordValue, readCount: number) {
  return (
    Number.isSafeInteger(diagnostic.readAttempts) &&
    (diagnostic.readAttempts as number) >= readCount &&
    Number.isSafeInteger(diagnostic.commandExecutions) &&
    (diagnostic.commandExecutions as number) >=
      (diagnostic.readAttempts as number)
  );
}

function parentReadShape(diagnostic: RecordValue | null) {
  const skills = skillSequence(diagnostic?.observedSkills);
  const rawReads = diagnostic?.completedReads;
  if (
    diagnostic?.completeness !== "complete" ||
    diagnostic.truncated !== false ||
    !skills ||
    !Array.isArray(rawReads) ||
    !validParentReadCounts(diagnostic, rawReads.length)
  )
    return null;
  return { skills, rawReads };
}

function validParentReadEntry(
  read: RecordValue | null,
  skills: string[],
  priorOrdinal: number,
) {
  return (
    !!read &&
    typeof read.skill === "string" &&
    skills.includes(read.skill) &&
    Number.isSafeInteger(read.ordinal) &&
    (read.ordinal as number) > priorOrdinal
  );
}

function parentReadCompletions(
  observations: unknown,
  native: ReturnType<typeof nativeControlEvidence>,
) {
  if (!native) return null;
  const observation = uniqueObservation(
    observations,
    "sevro.codex.native-calls",
  );
  const data = observation ? activationData(observation.data) : null;
  const shape = parentReadShape(activationData(data?.parentReadDiagnostics));
  if (!shape) return null;
  const { skills, rawReads } = shape;
  const reads = rawReads.map(activationData);
  if (
    reads.some(
      (read, index) =>
        !validParentReadEntry(
          read,
          skills,
          index === 0 ? -1 : (reads[index - 1]?.ordinal as number),
        ),
    ) ||
    skills.some((skill) => !reads.some((read) => read?.skill === skill))
  )
    return null;
  return reads as RecordValue[];
}

function validChildSessionOrder(
  children: Array<RecordValue | null>,
  expected: unknown[],
  truncated: boolean,
): boolean {
  return (
    !expected.some((threadId) => typeof threadId !== "string") &&
    truncated === expected.length > 8 &&
    children.length === Math.min(expected.length, 8) &&
    children.every((child, index) => child?.threadId === expected[index])
  );
}

function boundChildSessions(
  observations: unknown,
  native: ReturnType<typeof nativeControlEvidence>,
) {
  if (!native) return null;
  const observation = uniqueObservation(
    observations,
    "sevro.codex.native-calls",
  );
  const data = observation ? activationData(observation.data) : null;
  if (
    !Array.isArray(data?.childSessions) ||
    typeof data.childrenTruncated !== "boolean"
  )
    return null;
  const children = data.childSessions.map(activationData);
  if (children.some((child) => !child)) return null;
  const expected = [
    ...new Set(native.acceptedSpawns.map((spawn) => spawn.threadId)),
  ];
  if (!validChildSessionOrder(children, expected, data.childrenTruncated))
    return null;
  return {
    children: children as RecordValue[],
    truncated: data.childrenTruncated,
  };
}

function validNestedRequestFields(request: RecordValue): boolean {
  return (
    (request.taskName === undefined || typeof request.taskName === "string") &&
    (request.forkTurns === undefined ||
      (typeof request.forkTurns === "string" &&
        /^(?:none|all|[1-9][0-9]*)$/.test(request.forkTurns))) &&
    ["available", "unavailable", "ambiguous", "partial"].includes(
      String(request.sessionStatus),
    ) &&
    ["completed", "unavailable"].includes(String(request.readerResultStatus))
  );
}

function validNestedRequest(request: RecordValue): boolean {
  return (
    Number.isSafeInteger(request.requestedOrdinal) &&
    (request.requestedOrdinal as number) >= 0 &&
    ["accepted", "unaccepted"].includes(String(request.status)) &&
    validNestedRequestFields(request) &&
    (request.status !== "accepted" ||
      (typeof request.agentRef === "string" &&
        typeof request.threadId === "string"))
  );
}

function completeNestedRequests(
  bound: ReturnType<typeof boundChildSessions>,
): RecordValue[] | null {
  if (!bound || bound.truncated) return null;
  const segments = bound.children.map((child) => {
    if (
      child.status !== "available" ||
      child.requestsTruncated !== false ||
      !Array.isArray(child.nestedSpawns)
    )
      return null;
    const requests = child.nestedSpawns.map(activationData);
    if (requests.some((request) => !request || !validNestedRequest(request)))
      return null;
    const ordinals = requests.map(
      (request) => request!.requestedOrdinal as number,
    );
    if (
      ordinals.some(
        (ordinal, index) => index > 0 && ordinal <= ordinals[index - 1]!,
      )
    )
      return null;
    return requests as RecordValue[];
  });
  if (segments.some((segment) => !segment)) return null;
  return segments.flat() as RecordValue[];
}

function completeTurnSkillSequence(data: RecordValue) {
  const skills = skillSequence(data.observedSkills);
  if (
    !skills ||
    new Set(skills).size !== skills.length ||
    data.primarySkill !== (skills[0] ?? null)
  )
    return null;
  return skills;
}

function turnSkillEvidence(observations: unknown, id: string) {
  const observation = uniqueObservation(observations, id);
  const data = observation ? activationData(observation.data) : null;
  if (
    observation?.source !== "sevro.host.codex" ||
    observation.completeness !== "complete" ||
    data?.method !== "skill_file_read_probe"
  )
    return null;
  return completeTurnSkillSequence(data);
}

function codexEventRef(artifacts: unknown, id = "sevro.codex.events") {
  if (!Array.isArray(artifacts)) return null;
  const matches = artifacts.filter(
    (item) => item && typeof item === "object" && item.id === id,
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

async function codexEventText(
  artifacts: unknown,
  id = "sevro.codex.events",
): Promise<string | null> {
  const reference = codexEventRef(artifacts, id);
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

function noOwnerOrGoalControlOutcome(
  native: ReturnType<typeof nativeControlEvidence>,
) {
  return {
    status: !native
      ? "unavailable"
      : native.attemptedSpawn ||
          native.attemptedGoalControl ||
          native.acceptedSpawnCount > 0
        ? "failed"
        : "passed",
    detail:
      "Owner absence and goal-control absence require complete native evidence",
    evidenceRefs: native ? ["sevro.codex.native-calls"] : [],
  };
}

const NATIVE_CONTROL_GRADERS = new Map([
  ["no-agent-spawn", noAgentOutcome],
  ["no-native-goal-control", noNativeGoalControlOutcome],
  ["no-owner-or-goal-control", noOwnerOrGoalControlOutcome],
]);

function noSecondOwnerOutcome(
  native: ReturnType<typeof nativeControlEvidence>,
) {
  if (!native)
    return {
      status: "unavailable",
      detail: "Complete native owner evidence required",
      evidenceRefs: [],
    };
  const first = native.acceptedSpawns[0];
  const replacementAttempt = first
    ? native.toolCalls.some(
        (call) =>
          call.namespace === "collaboration" &&
          call.name === "spawn_agent" &&
          (call.ordinal as number) > (first.acceptedOrdinal as number),
      )
    : false;
  return {
    status:
      native.acceptedSpawnCount > 1 || replacementAttempt ? "failed" : "passed",
    detail: "Graded from correlated native owner receipts and spawn order",
    evidenceRefs: ["sevro.codex.native-calls"],
  };
}

function skillsInactiveOutcome(
  selected: RecordValue,
  native: ReturnType<typeof nativeControlEvidence>,
  observed: ReturnType<typeof observedActivation>,
) {
  const forbiddenSkills = skillSequence(selected.forbiddenSkills);
  if (
    !forbiddenSkills ||
    (typeof selected.forbidSpawn !== "boolean" &&
      selected.forbidSpawn !== undefined)
  )
    throw new Error("inactive skill check configuration is invalid");
  if (!native || !observed)
    return {
      status: "unavailable",
      detail: "Complete Codex skill-read and native-call observations required",
      evidenceRefs: [],
    };
  const activated = forbiddenSkills.some((skill) =>
    observed.observedSkills.includes(skill),
  );
  return {
    status:
      activated ||
      native.attemptedSkillTool ||
      (selected.forbidSpawn === true && native.attemptedSpawn)
        ? "failed"
        : "passed",
    detail: "Graded from complete Codex skill reads and native tool calls",
    evidenceRefs: ["sevro.codex.skill-reads", "sevro.codex.native-calls"],
  };
}

function supportingSkillOutcome(
  selected: RecordValue,
  observed: ReturnType<typeof observedActivation>,
) {
  if (selected.skill !== "adaptive-goal")
    throw new Error("supporting skill check configuration is invalid");
  return {
    status: observed
      ? observed.observedSkills.includes(selected.skill)
        ? "passed"
        : "failed"
      : "unavailable",
    detail: "Graded from complete supporting skill reads",
    evidenceRefs: observed ? ["sevro.codex.skill-reads"] : [],
  };
}

function completeBoundChildSkills(
  bound: ReturnType<typeof boundChildSessions>,
): string[] | null {
  if (!bound || bound.truncated || bound.children.length !== 1) return null;
  const child = bound.children[0];
  const diagnostic = child ? activationData(child.readDiagnostics) : null;
  return child?.status === "available" ? completeReadSkills(diagnostic) : null;
}

function completeReadSkills(diagnostic: RecordValue | null): string[] | null {
  if (diagnostic?.completeness !== "complete" || diagnostic.truncated !== false)
    return null;
  const skills = skillSequence(diagnostic.observedSkills);
  return skills && new Set(skills).size === skills.length ? skills : null;
}

function boundChildSkillOutcome(
  selected: RecordValue,
  native: ReturnType<typeof nativeControlEvidence>,
  bound: ReturnType<typeof boundChildSessions>,
) {
  if (selected.skill !== "create-pr" && selected.skill !== "ship-proposal")
    throw new Error("bound child skill check configuration is invalid");
  const skills =
    native?.acceptedSpawnCount === 1 ? completeBoundChildSkills(bound) : null;
  if (!skills)
    return {
      status: "unavailable",
      detail: "Bound child skill-read evidence unavailable or incomplete",
      evidenceRefs: [],
    };
  return {
    status: skills.includes(selected.skill) ? "passed" : "failed",
    detail: "Graded from the accepted child's complete skill reads",
    evidenceRefs: ["sevro.codex.native-calls"],
  };
}

function noParentWorkAfterHandoffOutcome(
  native: ReturnType<typeof nativeControlEvidence>,
) {
  if (!native || native.spawnCount !== 1 || native.acceptedSpawnCount !== 1)
    return {
      status: "unavailable",
      detail: "One accepted handoff and complete parent calls required",
      evidenceRefs: [],
    };
  return {
    status: parentWorkAfterAcceptance(
      native.toolCalls,
      native.acceptedSpawns[0]!,
    )
      ? "failed"
      : "passed",
    detail: "Graded from parent calls after native owner acceptance",
    evidenceRefs: ["sevro.codex.native-calls"],
  };
}

function inactiveControlsOutcome(
  selected: RecordValue,
  native: ReturnType<typeof nativeControlEvidence>,
  observed: ReturnType<typeof observedActivation>,
  events: string | null,
) {
  const forbiddenSkills = skillSequence(selected.forbiddenSkills ?? []);
  const forbiddenEventTerms = skillSequence(selected.forbiddenEventTerms ?? []);
  if (
    !forbiddenSkills ||
    !forbiddenEventTerms ||
    (selected.forbiddenEventPattern !== undefined &&
      !FORBIDDEN_EVENT_REGEX.has(String(selected.forbiddenEventPattern)))
  )
    throw new Error("inactive control check configuration is invalid");
  const required = inactiveControlEvidence(selected);
  if (!inactiveControlEvidenceAvailable(required, native, observed, events))
    return {
      status: "unavailable",
      detail: "Required skill, event, or native control evidence unavailable",
      evidenceRefs: [],
    };
  const violated = inactiveControlViolation(selected, {
    forbiddenSkills,
    forbiddenEventTerms,
    native,
    observed,
    events,
  });
  return {
    status: violated ? "failed" : "passed",
    detail: "Graded from complete Codex skill, event, and native controls",
    evidenceRefs: required,
  };
}

function inactiveControlEvidenceAvailable(
  required: string[],
  native: ReturnType<typeof nativeControlEvidence>,
  observed: ReturnType<typeof observedActivation>,
  events: string | null,
): boolean {
  return !(
    (required.includes("sevro.codex.skill-reads") && !observed) ||
    (required.includes("sevro.codex.events") && events === null) ||
    (required.includes("sevro.codex.native-calls") && !native)
  );
}

function inactiveControlViolation(
  selected: RecordValue,
  context: {
    forbiddenSkills: string[];
    forbiddenEventTerms: string[];
    native: ReturnType<typeof nativeControlEvidence>;
    observed: ReturnType<typeof observedActivation>;
    events: string | null;
  },
): boolean {
  const { forbiddenSkills, forbiddenEventTerms, native, observed, events } =
    context;
  return (
    forbiddenSkills.some((skill) => observed!.observedSkills.includes(skill)) ||
    forbiddenEventTerms.some((term) => events!.includes(term)) ||
    (typeof selected.forbiddenEventPattern === "string" &&
      FORBIDDEN_EVENT_REGEX.get(selected.forbiddenEventPattern)!.test(
        events!,
      )) ||
    (selected.forbidSpawn === true && native!.attemptedSpawn) ||
    (selected.forbidAgentTool === true &&
      native!.toolCalls.some((call) => call.name === "Agent"))
  );
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

function ownerRouteOutcome(
  selected: RecordValue,
  native: ReturnType<typeof nativeControlEvidence>,
) {
  if (
    typeof selected.model !== "string" ||
    typeof selected.reasoningEffort !== "string"
  )
    throw new Error("owner route check configuration is invalid");
  if (!native)
    return {
      status: "unavailable",
      detail: "Complete native owner route evidence required",
      evidenceRefs: [],
    };
  if (native.acceptedSpawnCount !== 1)
    return {
      status: "failed",
      detail: "Expected exactly one accepted owner route",
      evidenceRefs: ["sevro.codex.native-calls"],
    };
  const route = native.acceptedSpawns[0]!;
  return {
    status:
      typeof route.model !== "string" ||
      typeof route.reasoningEffort !== "string"
        ? "unavailable"
        : route.model === selected.model &&
            route.reasoningEffort === selected.reasoningEffort
          ? "passed"
          : "failed",
    detail: "Graded from the accepted native owner model and effort",
    evidenceRefs: ["sevro.codex.native-calls"],
  };
}

const REVIEW_AXIS_TOKENS = new Map([
  ["standards", /(^|[-_])standards($|[-_])/],
  ["spec", /(^|[-_])spec($|[-_])/],
]);

function nestedReviewAxis(taskName: unknown): string | null {
  if (typeof taskName !== "string") return null;
  const axes = [...REVIEW_AXIS_TOKENS].filter(([, pattern]) =>
    pattern.test(taskName),
  );
  return axes.length === 1 ? axes[0]![0] : null;
}

function inheritedContextRequested(request: RecordValue): boolean {
  return (
    typeof request.forkTurns === "string" &&
    /^(?:all|[1-9][0-9]*)$/.test(request.forkTurns)
  );
}

function nestedAxisStatus(axis: string, requests: RecordValue[]) {
  const matched = requests.filter(
    (request) =>
      request.status === "accepted" &&
      nestedReviewAxis(request.taskName) === axis,
  );
  if (!matched.length)
    return requests.some(
      (request) =>
        request.status === "accepted" &&
        nestedReviewAxis(request.taskName) === null,
    )
      ? "unavailable"
      : "failed";
  if (
    matched.some(
      (request) =>
        request.forkTurns === "none" &&
        request.sessionStatus === "available" &&
        request.readerResultStatus === "completed",
    )
  )
    return "passed";
  return matched.some(
    (request) =>
      request.forkTurns === undefined || request.sessionStatus !== "available",
  )
    ? "unavailable"
    : "failed";
}

function nestedReadersOutcome(
  selected: RecordValue,
  native: ReturnType<typeof nativeControlEvidence>,
  nested: RecordValue[] | null,
) {
  if (
    !Array.isArray(selected.axes) ||
    !selected.axes.every((axis) => axis === "spec" || axis === "standards")
  )
    throw new Error("nested reader axes are invalid");
  if (!native || !nested)
    return {
      status: "unavailable",
      detail: "Complete native nested-reader evidence required",
      evidenceRefs: [],
    };
  const inherited =
    native.acceptedSpawns.some(inheritedContextRequested) ||
    nested.some(inheritedContextRequested);
  if (inherited)
    return {
      status: "failed",
      detail: "Inherited context was requested for a provider or reader",
      evidenceRefs: ["sevro.codex.native-calls"],
    };
  if (native.spawnCount !== native.acceptedSpawnCount)
    return {
      status: "unavailable",
      detail:
        "An unaccepted provider request has no retained context-fork field",
      evidenceRefs: ["sevro.codex.native-calls"],
    };
  const statuses = (selected.axes as string[]).map((axis) =>
    nestedAxisStatus(axis, nested),
  );
  return {
    status: statuses.includes("failed")
      ? "failed"
      : statuses.includes("unavailable")
        ? "unavailable"
        : "passed",
    detail: "Graded from accepted nested readers and fresh-context receipts",
    evidenceRefs: ["sevro.codex.native-calls"],
  };
}

function freshProviderContextOutcome(
  native: ReturnType<typeof nativeControlEvidence>,
) {
  if (!native)
    return {
      status: "unavailable",
      detail: "Complete native owner evidence required",
      evidenceRefs: [],
    };
  const spawns = native.acceptedSpawns;
  return {
    status: spawns.some((spawn) => spawn.forkTurns === "none")
      ? "passed"
      : native.spawnCount !== native.acceptedSpawnCount
        ? "unavailable"
        : spawns.some((spawn) => spawn.forkTurns === undefined)
          ? "unavailable"
          : "failed",
    detail: "Graded from the accepted provider context-fork request",
    evidenceRefs: ["sevro.codex.native-calls"],
  };
}

function acceptedChildSessionOutcome(
  bound: ReturnType<typeof boundChildSessions>,
) {
  if (!bound)
    return {
      status: "unavailable",
      detail: "Bound native child-session evidence required",
      evidenceRefs: [],
    };
  return {
    status: bound.children.some((child) => child.status === "available")
      ? "passed"
      : bound.children.length > 0 || bound.truncated
        ? "unavailable"
        : "failed",
    detail: "Graded from the accepted provider child session",
    evidenceRefs: ["sevro.codex.native-calls"],
  };
}

function eventTermOutcome(selected: RecordValue, events: string | null) {
  if (selected.term !== "inspect-candidate")
    throw new Error("event term check configuration is invalid");
  return {
    status:
      events === null
        ? "unavailable"
        : events.includes(selected.term)
          ? "passed"
          : "failed",
    detail: "Graded from the digest-verified Codex event artifact",
    evidenceRefs: events === null ? [] : ["sevro.codex.events"],
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
      kind === "owner-after-continuation"
        ? acceptedAfter
        : kind === "owner-before-continuation"
          ? acceptedBefore
          : !acceptedBefore
    )
      ? "passed"
      : "failed",
    detail:
      "Graded from correlated owner acceptance and native follow-up ordinal",
    evidenceRefs: ["sevro.codex.native-calls", "sevro.codex.continuation"],
  };
}

function preOwnerSkillReadOutcome(
  selected: RecordValue,
  native: ReturnType<typeof nativeControlEvidence>,
  parentReads: ReturnType<typeof parentReadCompletions>,
) {
  if (selected.skill !== "assess-implementation-readiness")
    throw new Error("pre-owner skill check configuration is invalid");
  if (!native || !parentReads || native.acceptedSpawnCount !== 1)
    return {
      status: "unavailable",
      detail: "Complete parent reads and one accepted owner boundary required",
      evidenceRefs: [],
    };
  const ownerStart = native.acceptedSpawns[0]!.requestedOrdinal as number;
  return {
    status: parentReads.some(
      (read) =>
        read.skill === selected.skill && (read.ordinal as number) < ownerStart,
    )
      ? "passed"
      : "failed",
    detail:
      "Graded from verified parent skill completion before native owner launch",
    evidenceRefs: ["sevro.codex.native-calls"],
  };
}

function parentSkillReadCountOutcome(
  selected: RecordValue,
  parentReads: ReturnType<typeof parentReadCompletions>,
) {
  if (
    selected.skill !== "assess-implementation-readiness" ||
    !(
      (selected.min === 1 && selected.max === undefined) ||
      (selected.max === 1 && selected.min === undefined)
    )
  )
    throw new Error("parent skill count check configuration is invalid");
  if (!parentReads)
    return {
      status: "unavailable",
      detail: "Complete parent skill-read diagnostic required",
      evidenceRefs: [],
    };
  const count = parentReads.filter(
    (read) => read.skill === selected.skill,
  ).length;
  return {
    status:
      selected.min === 1
        ? count >= 1
          ? "passed"
          : "failed"
        : count <= 1
          ? "passed"
          : "failed",
    detail: "Graded from bounded verified parent skill-body completions",
    evidenceRefs: ["sevro.codex.native-calls"],
  };
}

function noReplacementAfterContinuationOutcome(
  native: ReturnType<typeof nativeControlEvidence>,
  continuation: ReturnType<typeof continuationEvidence>,
  followUpEvents: string | null,
) {
  const boundary = continuation?.nativeAfterOrdinal;
  if (
    !native ||
    boundary === null ||
    boundary === undefined ||
    followUpEvents === null
  )
    return {
      status: "unavailable",
      detail:
        "Complete native follow-up calls and verified follow-up events required",
      evidenceRefs: [],
    };
  const prohibitedCall = native.toolCalls.some(
    (call) =>
      (call.ordinal as number) > boundary &&
      ((call.namespace === "collaboration" && call.name === "spawn_agent") ||
        (call.namespace === "functions" && call.name === "create_goal")),
  );
  const prohibitedEvent = [
    '"type":"darrow.parent_spawn_after_goal"',
    "adaptive-goal-preflight step",
    "Protocol ledger",
  ].some((term) => followUpEvents.includes(term));
  return {
    status: prohibitedCall || prohibitedEvent ? "failed" : "passed",
    detail:
      "Graded from native calls and digest-verified events after the follow-up boundary",
    evidenceRefs: [
      "sevro.codex.native-calls",
      "sevro.codex.continuation",
      "sevro.codex.follow-up-events",
    ],
  };
}

function sameOwnerFeedbackOutcome(
  selected: RecordValue,
  native: ReturnType<typeof nativeFeedbackEvidence>,
  continuation: ReturnType<typeof continuationEvidence>,
) {
  if (typeof selected.responseRequired !== "boolean")
    throw new Error("feedback check configuration is invalid");
  const boundary = continuation?.nativeAfterOrdinal;
  if (!native || boundary === null || boundary === undefined)
    return {
      status: "unavailable",
      detail: "Native feedback and follow-up boundary evidence required",
      evidenceRefs: [],
    };
  const priorOwners = native.spawns.filter(
    (spawn) => (spawn.acceptedOrdinal as number) <= boundary,
  );
  const laterFeedback = native.feedback.filter(
    (call) =>
      (call.ordinal as number) > boundary &&
      ["followup_task", "send_message"].includes(String(call.tool)),
  );
  const matched = laterFeedback.some((call) =>
    priorOwners.some(
      (owner) =>
        (call.ordinal as number) > (owner.acceptedOrdinal as number) &&
        sameChildTarget(call.target, owner.agentRef as string) &&
        (!selected.responseRequired || call.responseObserved === true),
    ),
  );
  const unreadableTarget =
    priorOwners.length > 0 &&
    laterFeedback.some((call) => call.target === null);
  return {
    status: matched ? "passed" : unreadableTarget ? "unavailable" : "failed",
    detail: "Graded from the prior owner and bounded native feedback receipt",
    evidenceRefs: ["sevro.codex.native-calls", "sevro.codex.continuation"],
  };
}

function noPlaintextFeedbackMismatchOutcome(
  feedback: ReturnType<typeof nativeFeedbackEvidence>,
  continuation: ReturnType<typeof continuationEvidence>,
) {
  const boundary = continuation?.nativeAfterOrdinal;
  if (!feedback || boundary === null || boundary === undefined)
    return {
      status: "unavailable",
      detail: "Native feedback and follow-up boundary evidence required",
      evidenceRefs: [],
    };
  const later = feedback.feedback.filter(
    (call) => (call.ordinal as number) > boundary,
  );
  const valid = later.every(
    (call) =>
      (call.messageRepresentation === "plaintext" &&
        typeof call.messageMatchesFollowUpPrompt === "boolean") ||
      (["encrypted", "unavailable"].includes(
        String(call.messageRepresentation),
      ) &&
        call.messageMatchesFollowUpPrompt === null),
  );
  if (!valid)
    return {
      status: "unavailable",
      detail: "Native feedback message comparison unavailable or invalid",
      evidenceRefs: [],
    };
  const mismatch = later.some(
    (call) =>
      call.messageRepresentation === "plaintext" &&
      call.messageMatchesFollowUpPrompt === false,
  );
  return {
    status: mismatch ? "failed" : "passed",
    detail: "Graded from bounded plaintext feedback equality evidence",
    evidenceRefs: ["sevro.codex.native-calls", "sevro.codex.continuation"],
  };
}

function laterNativeSkillCall(
  selected: RecordValue,
  native: ReturnType<typeof nativeControlEvidence>,
  continuation: ReturnType<typeof continuationEvidence>,
): boolean | null {
  if (selected.forbidNativeSkillCall !== true) return false;
  const boundary = continuation?.nativeAfterOrdinal;
  if (!native || boundary === null || boundary === undefined) return null;
  return native.toolCalls.some(
    (call) => call.name === "Skill" && (call.ordinal as number) > boundary,
  );
}

function turnSkillOutcome(
  selected: RecordValue,
  context: {
    initial: ReturnType<typeof turnSkillEvidence>;
    followUp: ReturnType<typeof turnSkillEvidence>;
    native: ReturnType<typeof nativeControlEvidence>;
    continuation: ReturnType<typeof continuationEvidence>;
  },
) {
  const { initial, followUp, native, continuation } = context;
  if (typeof selected.skill !== "string")
    throw new Error("turn skill check configuration is invalid");
  const before = selected.kind === "skill-before-continuation";
  const skills = before ? initial : followUp;
  if (!skills)
    return {
      status: "unavailable",
      detail: "Complete turn-specific skill reads required",
      evidenceRefs: [],
    };
  const nativeSkillCall = laterNativeSkillCall(selected, native, continuation);
  if (nativeSkillCall === null)
    return {
      status: "unavailable",
      detail: "Native tool calls and follow-up ordinal required",
      evidenceRefs: [],
    };
  const read = skills.includes(selected.skill);
  return {
    status: (before ? read : !read && !nativeSkillCall) ? "passed" : "failed",
    detail: "Graded from turn-specific skill reads and native call order",
    evidenceRefs: [
      before
        ? "sevro.codex.initial-skill-reads"
        : "sevro.codex.follow-up-skill-reads",
      ...(selected.forbidNativeSkillCall === true
        ? ["sevro.codex.native-calls", "sevro.codex.continuation"]
        : []),
    ],
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

function nativeTranscriptOutcome(
  selected: RecordValue,
  native: ReturnType<typeof nativeControlEvidence>,
  skills: ReturnType<typeof observedActivation>,
) {
  const control = NATIVE_CONTROL_GRADERS.get(String(selected.kind));
  if (control) return control(native);
  if (selected.kind === "skills-inactive")
    return skillsInactiveOutcome(selected, native, skills);
  if (selected.kind === "supporting-skill-read")
    return supportingSkillOutcome(selected, skills);
  if (selected.kind === "no-parent-work-after-handoff")
    return noParentWorkAfterHandoffOutcome(native);
  if (selected.kind === "one-owner-accepted") return oneOwnerOutcome(native);
  if (selected.kind === "owner-route")
    return ownerRouteOutcome(selected, native);
  if (selected.kind === "no-second-owner") return noSecondOwnerOutcome(native);
  return null;
}

function feedbackTranscriptOutcome(
  selected: RecordValue,
  feedback: ReturnType<typeof nativeFeedbackEvidence>,
  continuation: ReturnType<typeof continuationEvidence>,
) {
  if (selected.kind === "same-owner-feedback")
    return sameOwnerFeedbackOutcome(selected, feedback, continuation);
  if (selected.kind === "no-plaintext-feedback-mismatch")
    return noPlaintextFeedbackMismatchOutcome(feedback, continuation);
  return null;
}

function policyTranscriptOutcome(
  selected: RecordValue,
  context: {
    native: ReturnType<typeof nativeControlEvidence>;
    nested: RecordValue[] | null;
    children: ReturnType<typeof boundChildSessions>;
    skills: ReturnType<typeof observedActivation>;
    events: string | null;
  },
) {
  if (selected.kind === "nested-readers")
    return nestedReadersOutcome(selected, context.native, context.nested);
  if (selected.kind === "fresh-provider-context")
    return freshProviderContextOutcome(context.native);
  if (selected.kind === "accepted-child-session")
    return acceptedChildSessionOutcome(context.children);
  if (selected.kind === "bound-child-skill")
    return boundChildSkillOutcome(selected, context.native, context.children);
  if (selected.kind === "event-term")
    return eventTermOutcome(selected, context.events);
  if (selected.kind === "inactive-controls")
    return inactiveControlsOutcome(
      selected,
      context.native,
      context.skills,
      context.events,
    );
  if (selected.kind === "no-lifecycle-ledger")
    return noLedgerOutcome(
      context.native,
      context.events,
      selected.terms,
      selected.forbidGoal,
    );
  return null;
}

function continuationTranscriptOutcome(
  selected: RecordValue,
  native: ReturnType<typeof nativeControlEvidence>,
  continuation: ReturnType<typeof continuationEvidence>,
  followUpEvents: string | null,
) {
  if (
    selected.kind === "continuation-boundary" ||
    selected.kind === "unchanged-before-continuation"
  )
    return continuationOutcome(selected.kind, continuation);
  if (
    selected.kind === "owner-after-continuation" ||
    selected.kind === "owner-before-continuation" ||
    selected.kind === "no-owner-before-continuation"
  )
    return ownerBoundaryOutcome(selected.kind, native, continuation);
  if (selected.kind === "no-replacement-after-continuation")
    return noReplacementAfterContinuationOutcome(
      native,
      continuation,
      followUpEvents,
    );
  return null;
}

function transcriptOutcome(
  selected: RecordValue,
  context: {
    native: ReturnType<typeof nativeControlEvidence>;
    parentReads: ReturnType<typeof parentReadCompletions>;
    nested: RecordValue[] | null;
    children: ReturnType<typeof boundChildSessions>;
    events: string | null;
    followUpEvents: string | null;
    continuation: ReturnType<typeof continuationEvidence>;
    skills: ReturnType<typeof observedActivation>;
    feedback: ReturnType<typeof nativeFeedbackEvidence>;
    initial: ReturnType<typeof turnSkillEvidence>;
    followUp: ReturnType<typeof turnSkillEvidence>;
  },
) {
  const { native, continuation, skills, feedback } = context;
  if (selected.kind === "pre-owner-skill-read")
    return preOwnerSkillReadOutcome(selected, native, context.parentReads);
  if (selected.kind === "parent-skill-read-count")
    return parentSkillReadCountOutcome(selected, context.parentReads);
  const direct = nativeTranscriptOutcome(selected, native, skills);
  if (direct) return direct;
  const feedbackOutcome = feedbackTranscriptOutcome(
    selected,
    feedback,
    continuation,
  );
  if (feedbackOutcome) return feedbackOutcome;
  const policyOutcome = policyTranscriptOutcome(selected, context);
  if (policyOutcome) return policyOutcome;
  if (
    selected.kind === "skill-before-continuation" ||
    selected.kind === "skill-absent-after-continuation"
  )
    return turnSkillOutcome(selected, context);
  const continuationResult = continuationTranscriptOutcome(
    selected,
    native,
    continuation,
    context.followUpEvents,
  );
  if (continuationResult) return continuationResult;
  throw new Error("unsupported native transcript check");
}

const CONTINUATION_EVIDENCE_KINDS = new Set([
  "continuation-boundary",
  "unchanged-before-continuation",
  "owner-after-continuation",
  "owner-before-continuation",
  "no-owner-before-continuation",
  "no-replacement-after-continuation",
  "same-owner-feedback",
  "no-plaintext-feedback-mismatch",
  "skill-absent-after-continuation",
]);

function readerObservationContext(
  kinds: Set<string>,
  observations: unknown,
  native: ReturnType<typeof nativeControlEvidence>,
) {
  const children =
    kinds.has("nested-readers") ||
    kinds.has("accepted-child-session") ||
    kinds.has("bound-child-skill")
      ? boundChildSessions(observations, native)
      : null;
  const nested = kinds.has("nested-readers")
    ? completeNestedRequests(children)
    : null;
  return { children, nested };
}

function parentReadObservationContext(
  kinds: Set<string>,
  observations: unknown,
  native: ReturnType<typeof nativeControlEvidence>,
) {
  return kinds.has("pre-owner-skill-read") ||
    kinds.has("parent-skill-read-count")
    ? parentReadCompletions(observations, native)
    : null;
}

function transcriptObservationContext(
  kinds: Set<string>,
  observations: unknown,
) {
  const native = nativeControlEvidence(observations);
  const parentReads = parentReadObservationContext(kinds, observations, native);
  const reader = readerObservationContext(kinds, observations, native);
  const feedback =
    kinds.has("same-owner-feedback") ||
    kinds.has("no-plaintext-feedback-mismatch")
      ? nativeFeedbackEvidence(observations)
      : null;
  const skills =
    kinds.has("skills-inactive") ||
    kinds.has("inactive-controls") ||
    kinds.has("supporting-skill-read")
      ? observedActivation(
          uniqueObservation(observations, "sevro.codex.skill-reads"),
          false,
        )
      : null;
  const initial = kinds.has("skill-before-continuation")
    ? turnSkillEvidence(observations, "sevro.codex.initial-skill-reads")
    : null;
  const followUp = kinds.has("skill-absent-after-continuation")
    ? turnSkillEvidence(observations, "sevro.codex.follow-up-skill-reads")
    : null;
  const continuation = [...kinds].some((kind) =>
    CONTINUATION_EVIDENCE_KINDS.has(kind),
  )
    ? continuationEvidence(observations)
    : null;
  return {
    native,
    parentReads,
    ...reader,
    feedback,
    skills,
    initial,
    followUp,
    continuation,
  };
}

function claudeTranscriptChecks(
  selected: RecordValue[],
  observations: unknown,
  artifacts: unknown,
) {
  if (!selected.some((entry) => String(entry.kind).startsWith("claude-")))
    return null;
  if (!selected.every((entry) => String(entry.kind).startsWith("claude-")))
    throw new Error("mixed native transcript policies are unsupported");
  return selected.some((entry) => entry.kind === "claude-selected-owner")
    ? claudeSelectedTranscriptChecks(selected, observations, artifacts)
    : claudeReadinessTranscriptChecks(selected, observations, artifacts);
}

async function nativeTranscriptChecks(
  value: unknown,
  observations: unknown,
  artifacts: unknown,
) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.length)
    throw new Error("native transcript checks are invalid");
  const selected = value.map((entry) =>
    record(entry, "native transcript check"),
  );
  const claude = claudeTranscriptChecks(selected, observations, artifacts);
  if (claude) return claude;
  const kinds = new Set(selected.map((entry) => String(entry.kind)));
  const events =
    kinds.has("no-lifecycle-ledger") ||
    kinds.has("inactive-controls") ||
    kinds.has("event-term")
      ? await codexEventText(artifacts)
      : null;
  const followUpEvents = kinds.has("no-replacement-after-continuation")
    ? await codexEventText(artifacts, "sevro.codex.follow-up-events")
    : null;
  const context = {
    ...transcriptObservationContext(kinds, observations),
    events,
    followUpEvents,
  };
  return selected.map((entry) => ({
    id: string(entry.id, "native transcript check ID"),
    ...(entry.kind === "guide-no-owner-or-goal-control"
      ? guideNativeControlOutcome(observations)
      : transcriptOutcome(entry, context)),
  }));
}

function validPortableCall(
  call: RecordValue,
  index: number,
  calls: RecordValue[],
) {
  return (
    Number.isSafeInteger(call.ordinal) &&
    (call.ordinal as number) >= 0 &&
    (index === 0 ||
      (call.ordinal as number) > (calls[index - 1]!.ordinal as number)) &&
    typeof call.namespace === "string" &&
    typeof call.name === "string" &&
    /^[A-Za-z0-9_.:-]{1,256}$/.test(call.name)
  );
}

function portableControlCounts(
  data: RecordValue,
  source: string,
  calls: RecordValue[],
) {
  if (source === "sevro.host.claude")
    return (
      data.acceptedAgentCount === null &&
      data.submittedExecCalls === null &&
      calls.every((call) => call.namespace === "claude")
    );
  const attempts = calls.filter(
    (call) => call.namespace === "collaboration" && call.name === "spawn_agent",
  ).length;
  return (
    Number.isSafeInteger(data.acceptedAgentCount) &&
    (data.acceptedAgentCount as number) >= 0 &&
    (data.acceptedAgentCount as number) <= attempts &&
    data.submittedExecCalls === 0 &&
    calls.every(validNativeToolCall)
  );
}

function portableObservationData(observations: unknown) {
  const observation = uniqueObservation(
    observations,
    "sevro.host.native-controls",
  );
  const data = observation ? activationData(observation.data) : null;
  if (
    observation?.completeness !== "complete" ||
    !["sevro.host.codex", "sevro.host.claude"].includes(
      String(observation.source),
    ) ||
    data?.method !== "native_control_calls" ||
    data.truncated !== false ||
    !Array.isArray(data.calls) ||
    data.calls.length > 128
  )
    return null;
  return { observation, data };
}

function portableControlRecord(observations: unknown) {
  const verified = portableObservationData(observations);
  if (!verified) return null;
  const { observation, data } = verified;
  const rawCalls = data.calls as unknown[];
  const calls = rawCalls.map(activationData);
  if (calls.some((call) => call === null)) return null;
  const labels = calls as RecordValue[];
  if (
    !labels.every(validPortableCall) ||
    !portableControlCounts(data, String(observation.source), labels)
  )
    return null;
  return { source: String(observation.source), data, calls: labels };
}

function sameNativeLabels(left: RecordValue[], right: RecordValue[]) {
  const labels = (calls: RecordValue[]) =>
    calls.map(({ ordinal, namespace, name }) => ({ ordinal, namespace, name }));
  return JSON.stringify(labels(left)) === JSON.stringify(labels(right));
}

function codexControlConsistency(
  common: NonNullable<ReturnType<typeof portableControlRecord>>,
  observations: unknown,
) {
  const native = nativeControlEvidence(observations);
  return (
    native !== null &&
    common.data.acceptedAgentCount === native.acceptedSpawnCount &&
    sameNativeLabels(native.toolCalls, common.calls)
  );
}

function claudeControlConsistency(
  common: NonNullable<ReturnType<typeof portableControlRecord>>,
  legacy: RecordValue,
  observations: unknown,
) {
  if (legacy.completeness !== "complete") return true;
  const calls = claudeCalls(observations);
  const names = common.calls
    .filter((call) => ["Skill", "Agent", "Task"].includes(String(call.name)))
    .map((call) => (call.name === "Task" ? "Agent" : call.name));
  return (
    calls !== null &&
    JSON.stringify(calls.map((call) => call.name)) === JSON.stringify(names)
  );
}

function legacyControlConsistency(
  common: NonNullable<ReturnType<typeof portableControlRecord>>,
  observations: unknown,
) {
  const claude = common.source === "sevro.host.claude";
  const id = claude ? "sevro.claude.tool-calls" : "sevro.codex.native-calls";
  const matches = (observations as unknown[])
    .map(activationData)
    .filter((observation) => observation?.id === id);
  if (!matches.length) return true;
  if (matches.length !== 1 || matches[0]?.source !== common.source)
    return false;
  return claude
    ? claudeControlConsistency(common, matches[0]!, observations)
    : codexControlConsistency(common, observations);
}

function guideNativeControlOutcome(observations: unknown) {
  const common = portableControlRecord(observations);
  const available =
    common !== null && legacyControlConsistency(common, observations);
  const prohibited =
    available &&
    common.calls.some(
      (call) =>
        ["Agent", "Task"].includes(String(call.name)) ||
        (call.namespace === "collaboration" && call.name === "spawn_agent") ||
        (["functions", "claude"].includes(String(call.namespace)) &&
          ["create_goal", "update_goal"].includes(String(call.name))),
    );
  return {
    status: !available ? "unavailable" : prohibited ? "failed" : "passed",
    detail: available
      ? "Graded owner and goal-control absence from complete native labels"
      : "Native control evidence unavailable, incomplete, or contradictory",
    evidenceRefs: available ? ["sevro.host.native-controls"] : [],
  };
}

function validClaudeAgent(call: RecordValue) {
  return (
    nonemptyString(call.toolUseId) &&
    nonemptyString(call.subagentType) &&
    typeof call.runInBackground === "boolean" &&
    /^[a-f0-9]{64}$/.test(String(call.promptSha256))
  );
}

function validClaudeCall(
  call: RecordValue | null,
  index: number,
  calls: Array<RecordValue | null>,
) {
  if (!call) return false;
  if (
    !Number.isSafeInteger(call.ordinal) ||
    (call.ordinal as number) < 1 ||
    (index > 0 &&
      (call.ordinal as number) <= (calls[index - 1]!.ordinal as number)) ||
    !["parent", "nested"].includes(String(call.actor))
  )
    return false;
  if (call.name === "Skill")
    return nonemptyString(call.skill) && nonemptyString(call.invocation);
  return call.name === "Agent" && validClaudeAgent(call);
}

function claudeCalls(observations: unknown): RecordValue[] | null {
  const observation = uniqueObservation(
    observations,
    "sevro.claude.tool-calls",
  );
  const data = observation ? activationData(observation.data) : null;
  if (
    observation?.completeness !== "complete" ||
    observation.source !== "sevro.host.claude" ||
    data?.method !== "stream_tool_calls" ||
    data.truncated !== false ||
    !Array.isArray(data.calls)
  )
    return null;
  const calls = data.calls.map(activationData);
  if (!calls.every(validClaudeCall)) return null;
  return calls as RecordValue[];
}

function claudeOwner(call: RecordValue) {
  return (
    call.name === "Agent" &&
    String(call.subagentType).startsWith("darrow-adaptive-goal:adaptive-goal-")
  );
}

function claudeReadinessSkill(call: RecordValue) {
  return (
    call.name === "Skill" &&
    call.skill === "assess-implementation-readiness" &&
    [
      "assess-implementation-readiness",
      "darrow-readiness-gate:assess-implementation-readiness",
    ].includes(String(call.invocation))
  );
}

function claudeReadinessOwnershipChecks(observations: unknown) {
  const calls = claudeCalls(observations);
  const ownerCount = calls?.filter(claudeOwner).length;
  const ref = calls ? "sevro.claude.tool-calls" : null;
  return [
    ownershipCheck(
      OWNERSHIP_CHECKS[0],
      ownerCount === undefined
        ? "unavailable"
        : ownerCount <= 1
          ? "passed"
          : "failed",
      ref,
      "No replacement owner is launched",
    ),
    ownershipCheck(
      OWNERSHIP_CHECKS[1],
      ownerCount === 0 ? "passed" : "unavailable",
      ref,
      "No parent work follows an owner handoff",
    ),
    internalRecordCheck(observations, "sevro.host.claude"),
  ];
}

function claudeReadinessPassed(
  kind: string,
  readinessCount: number | undefined,
  ownerCount: number | undefined,
  events: string | null,
) {
  if (kind === "claude-readiness-once") return readinessCount === 1;
  if (kind === "claude-readiness-no-retry")
    return readinessCount !== undefined && readinessCount <= 1;
  if (kind === "claude-no-owner") return ownerCount === 0;
  if (kind === "claude-no-ledger")
    return (
      events !== null &&
      !events.includes("adaptive-goal-preflight step") &&
      !events.includes("darrow-native-goal-report")
    );
  throw new Error("unsupported Claude readiness check");
}

function claudeReadinessTranscriptOutcome(
  check: RecordValue,
  readinessCount: number | undefined,
  ownerCount: number | undefined,
  events: string | null,
) {
  const kind = String(check.kind);
  const ledger = kind === "claude-no-ledger";
  const available = ledger ? events !== null : readinessCount !== undefined;
  return {
    id: string(check.id, "Claude transcript check ID"),
    status: !available
      ? "unavailable"
      : claudeReadinessPassed(kind, readinessCount, ownerCount, events)
        ? "passed"
        : "failed",
    detail: available
      ? "Graded from complete Claude host evidence"
      : "Claude host evidence unavailable or incomplete",
    evidenceRefs: available
      ? [ledger ? "sevro.claude.events" : "sevro.claude.tool-calls"]
      : [],
  };
}

async function claudeReadinessTranscriptChecks(
  selected: RecordValue[],
  observations: unknown,
  artifacts: unknown,
) {
  const calls = claudeCalls(observations);
  const events = await codexEventText(artifacts, "sevro.claude.events");
  const readinessCount = calls?.filter(claudeReadinessSkill).length;
  const ownerCount = calls?.filter(claudeOwner).length;
  return selected.map((check) =>
    claudeReadinessTranscriptOutcome(check, readinessCount, ownerCount, events),
  );
}

const CLAUDE_OWNER_MARKER = createHash("sha256")
  .update("- phase: adaptive-goal-owner")
  .digest("hex");
const CLAUDE_SELECTED_TYPE =
  "darrow-adaptive-goal:adaptive-goal-sonnet-5-5-low";

function claudeSelectedCalls(observations: unknown) {
  const calls = claudeCalls(observations);
  if (
    !calls ||
    calls.some(
      (call) =>
        !(
          call.parentToolUseId === null || nonemptyString(call.parentToolUseId)
        ) ||
        (call.actor === "parent") !== (call.parentToolUseId === null) ||
        (call.name === "Agent" &&
          !/^[a-f0-9]{64}$/.test(String(call.promptFirstLineSha256))),
    )
  )
    return null;
  return calls;
}

function claudeSelectedOwner(calls: RecordValue[] | null) {
  if (!calls) return null;
  const owners = calls.filter(claudeOwner);
  if (owners.length !== 1) return null;
  return owners[0]!;
}

function claudeNestedSkills(observations: unknown): RecordValue[] | null {
  const observation = uniqueObservation(
    observations,
    "sevro.claude.nested-skills",
  );
  const data = observation ? activationData(observation.data) : null;
  if (
    observation?.source !== "sevro.host.claude" ||
    observation.completeness !== "complete" ||
    data?.method !== "native_session_graph" ||
    !Array.isArray(data.calls) ||
    data.calls.length > 128
  )
    return null;
  const calls = data.calls.map(activationData);
  if (
    calls.some(
      (call) =>
        !call ||
        !nonemptyString(call.ancestorToolUseId) ||
        !nonemptyString(call.invocation) ||
        call.skill !== String(call.invocation).split(":").at(-1),
    )
  )
    return null;
  return calls as RecordValue[];
}

function claudeRawEvents(text: string | null): RecordValue[] | null {
  if (text === null) return null;
  try {
    const events = text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => record(JSON.parse(line) as unknown, "Claude event"));
    return events.some((event) => event.type === "result") ? events : null;
  } catch {
    return null;
  }
}

function claudeEventBlocks(event: RecordValue): RecordValue[] {
  const message = event.message;
  if (!message || typeof message !== "object" || Array.isArray(message))
    return [];
  const content = (message as RecordValue).content;
  return Array.isArray(content)
    ? content.filter(
        (block): block is RecordValue =>
          !!block && typeof block === "object" && !Array.isArray(block),
      )
    : [];
}

function claudeWithinOwner(
  call: RecordValue,
  calls: RecordValue[],
  ownerId: string,
) {
  let parent = call.parentToolUseId;
  const seen = new Set<string>();
  while (nonemptyString(parent) && !seen.has(parent)) {
    if (parent === ownerId) return true;
    seen.add(parent);
    parent = calls.find(
      (candidate) =>
        candidate.name === "Agent" && candidate.toolUseId === parent,
    )?.parentToolUseId;
  }
  return false;
}

function claudeResolverCommand(command: unknown) {
  if (typeof command !== "string") return false;
  const wrapper = command.match(/^cd "([^"\r\n]+)" && (.+) 2>&1$/);
  const core = wrapper ? wrapper[2]! : command;
  const match = core.match(
    /^uv run --quiet --no-project ("[^"\r\n]+"|'[^'\r\n]+'|\/[A-Za-z0-9_./-]+) claude-agent-route --provider anthropic --model claude-sonnet-5 --effort low$/,
  );
  if (!match) return false;
  const path = match[1]!.replace(/^(?:"|')|(?:"|')$/g, "");
  return (
    /^\/[A-Za-z0-9_./-]+$/.test(path) &&
    !path.split("/").includes("..") &&
    path.endsWith("/backend/scripts/run_locked.py") &&
    (!wrapper ||
      (/^\/[A-Za-z0-9_./-]+$/.test(wrapper[1]!) &&
        path ===
          `${wrapper[1]}/.sevro-marketplace/plugin/backend/scripts/run_locked.py`))
  );
}

function claudeResolverResult(block: RecordValue) {
  if (block.is_error === true) return false;
  const content = block.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .filter(
              (item): item is RecordValue =>
                !!item && typeof item === "object" && !Array.isArray(item),
            )
            .filter(
              (item) => item.type === "text" && typeof item.text === "string",
            )
            .map((item) => item.text)
            .join("\n")
        : "";
  return /(?:^|\n)format\tdarrow-claude-agent-route-v1\r?\nselected_route\tclaude\tanthropic\tclaude-sonnet-5\tlow\r?\nsubagent_type\tdarrow-adaptive-goal:adaptive-goal-sonnet-5-5-low\r?\nagent_file\t\/[^\r\n]*\/agents\/adaptive-goal-sonnet-5-5-low\.md(?:\r?\n|$)/.test(
    text,
  );
}

function claudeRouteConfirmed(events: RecordValue[], owner: RecordValue) {
  const uses = events.flatMap((event, index) =>
    event.type === "assistant" && !event.parent_tool_use_id
      ? claudeEventBlocks(event)
          .filter(
            (block) =>
              block.type === "tool_use" &&
              block.name === "Bash" &&
              claudeResolverCommand(
                block.input && typeof block.input === "object"
                  ? (block.input as RecordValue).command
                  : null,
              ),
          )
          .map((block) => ({ id: block.id, index }))
      : [],
  );
  if (uses.length !== 1 || !nonemptyString(uses[0]!.id)) return false;
  const call = uses[0]!;
  const resultIndex = events.findIndex(
    (event, index) =>
      index > call.index &&
      event.type === "user" &&
      !event.parent_tool_use_id &&
      claudeEventBlocks(event).some(
        (block) =>
          block.type === "tool_result" &&
          block.tool_use_id === call.id &&
          claudeResolverResult(block),
      ),
  );
  const ownerIndex = events.findIndex(
    (event) =>
      event.type === "assistant" &&
      !event.parent_tool_use_id &&
      claudeEventBlocks(event).some(
        (block) => block.type === "tool_use" && block.id === owner.toolUseId,
      ),
  );
  return resultIndex > call.index && ownerIndex > resultIndex;
}

function claudeParentWorkAfterOwner(
  events: RecordValue[],
  owner: RecordValue,
): boolean | null {
  const resultIndex = events.findIndex(
    (event) =>
      event.type === "user" &&
      !event.parent_tool_use_id &&
      claudeEventBlocks(event).some(
        (block) =>
          block.type === "tool_result" &&
          block.tool_use_id === owner.toolUseId &&
          block.is_error !== true,
      ),
  );
  if (resultIndex < 0) return null;
  return events
    .slice(resultIndex + 1)
    .some(
      (event) =>
        event.type === "assistant" &&
        !event.parent_tool_use_id &&
        claudeEventBlocks(event).some((block) => block.type === "tool_use"),
    );
}

async function claudeSelectedOwnershipChecks(
  observations: unknown,
  artifacts: unknown,
) {
  const calls = claudeSelectedCalls(observations);
  const owner = claudeSelectedOwner(calls);
  const events = claudeRawEvents(
    await codexEventText(artifacts, "sevro.claude.events"),
  );
  const after =
    events && owner ? claudeParentWorkAfterOwner(events, owner) : null;
  return [
    ownershipCheck(
      OWNERSHIP_CHECKS[0],
      !calls
        ? "unavailable"
        : calls.filter(claudeOwner).length <= 1
          ? "passed"
          : "failed",
      calls ? "sevro.claude.tool-calls" : null,
      "No replacement owner is launched",
    ),
    ownershipCheck(
      OWNERSHIP_CHECKS[1],
      after === null ? "unavailable" : after ? "failed" : "passed",
      after === null ? null : "sevro.claude.events",
      "No parent tool call follows the foreground owner result",
    ),
    internalRecordCheck(observations, "sevro.host.claude"),
  ];
}

function claudeMarkedOwner(owner: RecordValue | null) {
  return (
    !!owner &&
    owner.actor === "parent" &&
    owner.parentToolUseId === null &&
    owner.subagentType === CLAUDE_SELECTED_TYPE &&
    owner.runInBackground === false &&
    owner.model === null &&
    owner.promptFirstLineSha256 === CLAUDE_OWNER_MARKER
  );
}

function claudeIndependentReview(
  calls: RecordValue[] | null,
  owner: RecordValue | null,
  nested: RecordValue[] | null,
) {
  return (
    !!owner &&
    (!!calls?.some(
      (call) =>
        call.name === "Skill" &&
        call.invocation === "independent-code-review" &&
        claudeWithinOwner(call, calls, String(owner.toolUseId)),
    ) ||
      !!nested?.some(
        (call) =>
          call.invocation === "independent-code-review" &&
          call.ancestorToolUseId === owner.toolUseId,
      ))
  );
}

function claudeNoLedger(eventsText: string | null) {
  return (
    eventsText !== null &&
    ![
      "adaptive-goal-preflight step",
      "Protocol ledger",
      "claude-route-gate",
    ].some((term) => eventsText.includes(term))
  );
}

type ClaudeSelectedContext = {
  calls: RecordValue[] | null;
  nested: RecordValue[] | null;
  owner: RecordValue | null;
  eventsText: string | null;
  events: RecordValue[] | null;
};

function claudeSelectedPassed(kind: string, context: ClaudeSelectedContext) {
  const { calls, nested, owner, eventsText, events } = context;
  if (kind === "claude-selected-owner") return claudeMarkedOwner(owner);
  if (kind === "claude-one-owner")
    return calls?.filter(claudeOwner).length === 1;
  if (kind === "claude-independent-review")
    return claudeIndependentReview(calls, owner, nested);
  if (kind === "claude-selected-route")
    return !!events && !!owner && claudeRouteConfirmed(events, owner);
  if (kind === "claude-no-ledger") return claudeNoLedger(eventsText);
  throw new Error("unsupported Claude selected-owner check");
}

function claudeSelectedAvailable(kind: string, context: ClaudeSelectedContext) {
  if (kind === "claude-no-ledger") return context.events !== null;
  if (kind === "claude-selected-route")
    return context.events !== null && context.calls !== null;
  if (context.calls === null) return false;
  if (kind !== "claude-independent-review") return true;
  return (
    context.nested !== null ||
    claudeIndependentReview(context.calls, context.owner, null)
  );
}

function claudeSelectedEvidenceRef(
  kind: string,
  context: ClaudeSelectedContext,
) {
  if (kind === "claude-selected-route" || kind === "claude-no-ledger")
    return "sevro.claude.events";
  const directReview =
    kind === "claude-independent-review" &&
    claudeIndependentReview(context.calls, context.owner, null);
  return kind === "claude-independent-review" && !directReview
    ? "sevro.claude.nested-skills"
    : "sevro.claude.tool-calls";
}

function claudeSelectedTranscriptOutcome(
  check: RecordValue,
  context: ClaudeSelectedContext,
) {
  const kind = String(check.kind);
  const available = claudeSelectedAvailable(kind, context);
  return {
    id: string(check.id, "Claude transcript check ID"),
    status: !available
      ? "unavailable"
      : claudeSelectedPassed(kind, context)
        ? "passed"
        : "failed",
    detail: available
      ? "Graded from complete Claude host evidence"
      : "Claude host evidence unavailable or incomplete",
    evidenceRefs: available ? [claudeSelectedEvidenceRef(kind, context)] : [],
  };
}

async function claudeSelectedTranscriptChecks(
  selected: RecordValue[],
  observations: unknown,
  artifacts: unknown,
) {
  const calls = claudeSelectedCalls(observations);
  const nested = claudeNestedSkills(observations);
  const owner = claudeSelectedOwner(calls);
  const eventsText = await codexEventText(artifacts, "sevro.claude.events");
  const events = claudeRawEvents(eventsText);
  const context = { calls, nested, owner, eventsText, events };
  return selected.map((check) =>
    claudeSelectedTranscriptOutcome(check, context),
  );
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

async function caseOwnershipChecks(details: RecordValue, params: RecordValue) {
  if (details.ownership === true || details.ownership === "composition")
    return ownershipChecks(params.observations);
  if (details.ownership === "claude")
    return claudeReadinessOwnershipChecks(params.observations);
  if (details.ownership === "claude-selected")
    return claudeSelectedOwnershipChecks(params.observations, params.artifacts);
  return [];
}

function guideDisclosureStatus(observations: unknown): OwnershipStatus {
  const final = uniqueObservation(
    observations,
    "sevro.observation.final-message",
  );
  const text = final ? activationData(final.data)?.text : undefined;
  const available =
    final?.completeness === "complete" &&
    ["sevro.host.codex", "sevro.host.claude"].includes(String(final.source)) &&
    typeof text === "string";
  if (!available) return "unavailable";
  if (final.source === "sevro.host.codex") return "passed";
  return /best.effort/i.test(text) &&
    /primar[^.]*Codex|Codex[^.]*primar/i.test(text)
    ? "passed"
    : "failed";
}

function guideDisclosureOutcomes(checkIds: unknown, observations: unknown) {
  if (checkIds === undefined) return [];
  if (!Array.isArray(checkIds) || !checkIds.length || checkIds.length > 128)
    throw new Error("guide disclosure check IDs are invalid");
  const ids = checkIds.map((id) => string(id, "guide disclosure check ID"));
  if (new Set(ids).size !== ids.length)
    throw new Error("duplicate guide disclosure check ID");
  const status = guideDisclosureStatus(observations);
  const available = status !== "unavailable";
  return ids.map((id) => ({
    id,
    status,
    detail: available
      ? "Graded host disclosure from the retained final response"
      : "Host response evidence unavailable or incomplete",
    evidenceRefs: available ? ["sevro.observation.final-message"] : [],
  }));
}

async function currentNativeTranscriptChecks(
  details: RecordValue,
  params: RecordValue,
) {
  if (details.nativeTranscriptChecks === undefined) return [];
  const nativeGoal = uniqueObservation(
    params.observations,
    "sevro.host.native-goal",
  );
  const eventId =
    nativeGoal?.source === "sevro.host.claude"
      ? "sevro.claude.events"
      : "sevro.codex.events";
  const events = await codexEventText(params.artifacts, eventId);
  const tools = claudeCalls(params.observations);
  return nativeTranscriptOutcomes(
    details.nativeTranscriptChecks as NativeTranscript[],
    params.observations,
    {
      events,
      eventId,
      spawns:
        nativeControlEvidence(params.observations)?.acceptedSpawns ?? null,
      claudeTools: tools,
      claudeNestedSkills: claudeNestedSkills(params.observations),
      claudeCompletedRoutes: currentClaudeCompletedRoutes(tools, events),
    },
  );
}

function currentClaudeCompletedRoutes(
  calls: RecordValue[] | null,
  text: string | null,
): RecordValue[] | null {
  const events = claudeRawEvents(text);
  if (!calls || !events) return null;
  const results = events.filter(
    (event) => event.type === "result" && !event.parent_tool_use_id,
  );
  if (
    results.length !== 1 ||
    results[0]!.subtype !== "success" ||
    results[0]!.is_error !== false
  )
    return null;
  const routes = calls.filter(
    (call) => call.name === "Agent" && call.actor === "parent",
  );
  if (new Set(routes.map((call) => call.toolUseId)).size !== routes.length)
    return null;
  return routes.every((call) => currentClaudeRouteCompleted(events, call))
    ? routes
    : null;
}

function currentClaudeRouteBlocks(
  events: RecordValue[],
  call: RecordValue,
  result: boolean,
) {
  return events.flatMap((event, index) =>
    event.type === (result ? "user" : "assistant") && !event.parent_tool_use_id
      ? claudeEventBlocks(event)
          .filter(
            (block) =>
              block.type === (result ? "tool_result" : "tool_use") &&
              (result ? block.tool_use_id : block.id) === call.toolUseId,
          )
          .map((block) => ({ block, index }))
      : [],
  );
}

function currentClaudeRouteInvocation(block: RecordValue, call: RecordValue) {
  const input = activationData(block.input);
  return (
    ["Agent", "Task"].includes(String(block.name)) &&
    (input?.subagent_type ?? input?.subagentType) === call.subagentType &&
    input?.run_in_background === call.runInBackground
  );
}

function currentClaudeRouteCompleted(events: RecordValue[], call: RecordValue) {
  if (call.parentToolUseId !== null) return false;
  const uses = currentClaudeRouteBlocks(events, call, false);
  const completions = currentClaudeRouteBlocks(events, call, true);
  return (
    uses.length === 1 &&
    completions.length === 1 &&
    currentClaudeRouteInvocation(uses[0]!.block, call) &&
    completions[0]!.index > uses[0]!.index &&
    completions[0]!.block.is_error !== true
  );
}

async function evaluateCase(params: RecordValue) {
  const omitSkills = withoutSkill(params.configuration);
  const extensionData = record(
    params.extensionData,
    "evaluation extension data",
  );
  const details = record(extensionData["darrow.case"], "Darrow case data");
  const metrics = caseMetrics(details, params);
  const ownership = await caseOwnershipChecks(details, params);
  const checks = [
    ...nativeGoalOutcomes(details.nativeGoal, params.observations),
    ...(await currentNativeTranscriptChecks(details, params)),
    ...guideDisclosureOutcomes(details.disclosureChecks, params.observations),
    ...caseBenchmarkChecks(details, params),
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
  const observation = caseActivationObservation(params.observations, details);
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

function caseBenchmarkChecks(details: RecordValue, params: RecordValue) {
  return [
    ...benchmarkRecordChecks(
      details.benchmarkRecords,
      uniqueObservation(params.observations, "sevro.observation.final-message"),
    ),
    ...nativeOwnerRouteChecks(
      details.benchmarkOwnerRoute,
      nativeControlEvidence(params.observations),
    ),
  ];
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
              "sevro.host.native-goal",
              "sevro.case.host-route",
              "sevro.fixture.setup",
              "sevro.host.continuation",
              "sevro.host.native-controls",
              "sevro.codex.plugin-marketplace",
              "sevro.codex.explicit-invocation",
              "sevro.codex.repository-invocation",
              "sevro.codex.native-calls",
              "sevro.claude.plugin-dirs",
              "sevro.claude.explicit-invocation",
              "sevro.claude.repository-invocation",
            ],
            graders: [
              "darrow.evals.native-goal",
              "darrow.evals.ownership",
              "darrow.evals.transcript",
              "darrow.evals.disclosure",
              "darrow.evals.benchmark",
            ],
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
