import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { parse } from "yaml";
import { join, resolve } from "node:path";
import { captureTestCommand } from "../test-command";
import {
  sevroCommand,
  sevroEnvironment,
} from "../sevro-extension/sevro-command";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

for (const [name, goalComplete, routeMode, expected] of [
  ["complete goal, unused partial controls", true, null, "passed"],
  ["incomplete required goal", false, null, "not_assessed"],
  ["accepted route, unused partial controls", true, "correct", "passed"],
  ["wrong accepted route", true, "wrong", "failed"],
  ["incomplete required route", true, "missing", "not_assessed"],
] as const)
  test(
    name,
    async () => {
      const root = await mkdtemp(join(tmpdir(), "darrow-goal-evidence-"));
      roots.push(root);
      const routeCase = parse(
        await readFile(
          resolve(
            import.meta.dir,
            "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/routing-difficult-routine-diagnosis.yaml",
          ),
          "utf8",
        ),
      );
      const calls = {
        id: "sevro.codex.native-calls",
        source: "sevro.host.codex",
        completeness: routeMode === "missing" ? "partial" : "complete",
        data: {
          method: "native_session",
          calls: [
            {
              ordinal: 2,
              namespace: "collaboration",
              name: "spawn_agent",
              evidence: "invocation_attempt",
            },
          ],
          toolCalls: [
            { ordinal: 1, namespace: "other", name: "exec" },
            { ordinal: 2, namespace: "collaboration", name: "spawn_agent" },
          ],
          submittedExecCalls: 1,
          execCalls: [{ ordinal: 1, completeness: "partial", calls: [] }],
          acceptedSpawns: [
            {
              requestedOrdinal: 2,
              startedOrdinal: 3,
              acceptedOrdinal: 4,
              agentRef: "/root/implementation",
              model: routeMode === "wrong" ? "wrong-model" : "gpt-6-astra",
              reasoningEffort: "high",
              forkTurns: "none",
            },
          ],
        },
      };
      const cases = join(root, "evals/experiments/probe/cases");
      await mkdir(cases, { recursive: true });
      await writeFile(
        join(cases, "probe.yaml"),
        JSON.stringify({
          id: "goal-evidence-probe",
          invariant: "SE-C33",
          native_goal: "required",
          prompt: "Return done.",
          fixture: {
            commits: [
              { message: "Initialize", files: { "README.md": "probe\n" } },
            ],
          },
          checks: [],
          ...(routeMode
            ? { transcript_checks: [routeCase.transcript_checks[0]] }
            : {}),
          output_checks: [{ name: "done", expect_exact: "done" }],
        }),
      );
      const commandFile = join(root, "extension-command.json");
      await writeFile(
        commandFile,
        JSON.stringify([
          process.execPath,
          resolve(import.meta.dir, "../sevro-extension/index.ts"),
        ]),
      );
      const adapter = join(root, "candidate.ts");
      await writeFile(
        adapter,
        `export default {
    id: "sevro.host.codex", model: "fixture-native-goal", effort: "none",
    hostCapabilities: ["sevro.host.native-goal", "sevro.host.native-controls", "sevro.codex.native-calls"],
    async run() { return { finalMessage: "done", complete: true, observations: [
      ...${JSON.stringify(routeMode ? [calls] : [])},
      { id: "sevro.host.native-goal", source: "sevro.host.codex", completeness: ${JSON.stringify(goalComplete ? "complete" : "partial")},
        data: { threadId: "probe-thread", goals: [{ status: "complete", characters: 10 }], goalStatus: "complete" } },
      { id: "sevro.host.native-controls", source: "sevro.host.codex", completeness: "partial",
        data: { method: "native_control_calls", calls: [{ ordinal: 1, namespace: "other", name: "exec" }],
          acceptedAgentCount: null, submittedExecCalls: null, truncated: null,
          execCalls: [{ ordinal: 1, completeness: "partial", calls: [] }] } },
    ] }; }
  };`,
      );
      const route = sevroCommand();
      const env = sevroEnvironment();
      delete env.SEVRO_CHECKOUT;
      delete env.SEVRO_PACKAGE_BIN;
      const reply = await captureTestCommand(
        [
          ...route.launch,
          "run",
          "--json",
          ...route.extraArgs,
          "--extension-command-file",
          commandFile,
          "--extension-source-file",
          resolve(import.meta.dir, "../sevro-extension/index.ts"),
          "--project-root",
          root,
          "--results-root",
          join(root, "results"),
          "--case-id",
          "goal-evidence-probe",
          "--adapter-module",
          adapter,
          "--condition",
          "passive",
          "--trials",
          "1",
          "--jobs",
          "1",
          "--threshold",
          "1",
        ],
        undefined,
        { env },
      );
      const result = JSON.parse(reply.stdout) as {
        task: { verdict: string };
        cases: { trials: { artifactPath: string }[] }[];
      };
      expect(reply.exitCode, reply.stderr + reply.stdout).toBe(
        expected === "passed" ? 0 : expected === "failed" ? 1 : 4,
      );
      expect(result.task.verdict).toBe(expected);
      const trial = JSON.parse(
        await readFile(result.cases[0]!.trials[0]!.artifactPath, "utf8"),
      ) as {
        evidence: { observations: { id: string; completeness: string }[] };
      };
      expect(
        trial.evidence.observations.find(
          (o) => o.id === "sevro.host.native-controls",
        )?.completeness,
      ).toBe("partial");
    },
    30_000,
  );
