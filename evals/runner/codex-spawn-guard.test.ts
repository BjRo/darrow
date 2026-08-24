import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  guardCodexSpawn,
  fixtureStateFingerprint,
  repositoryFingerprint,
  verifiedCodexAcceptedAgentRef,
  verifiedCodexSpawnAttestation,
} from "./codex-spawn-guard";

const contract = [
  "Outcome: Change the fixture behavior.",
  "Acceptance criteria: The requested behavior and checks pass.",
  "Scope: The fixture implementation and its tests.",
  "Non-goals: No unrelated refactor or publication.",
  "Preserved work: Preserve all pre-existing user changes.",
  "Permissions: Local edits and checks only; no publication.",
  "Workflow sequence: Change feature, focused checks, then final checks.",
  "Feedback checks: Run the focused behavior check after each edit.",
  "Final-tree checks: Run the repository test script after implementation.",
  "Readiness gate: selected — assess the authoritative request before mutation.",
  "Independent review: selected — high-risk final-tree review is required.",
  "Stopping budget: No user-specified numeric limit.",
  "Human feedback: Pause mutation and ask one smallest material question.",
  "Completion report: Begin terminal output with the canonical report.",
  "Protocol ledger: /tmp/darrow-goal-run.fixture",
].join("\n");

function hookInput(cwd: string, message = contract) {
  return {
    hook_event_name: "PreToolUse",
    tool_use_id: "owner-tool-use",
    turn_id: "parent-turn",
    cwd,
    tool_name: "spawn_agent",
    tool_input: {
      task_name: "adaptive_goal_runner",
      message: `- phase: adaptive-goal-runner\n${message}`,
      model: "gpt-5.6-luna",
      reasoning_effort: "low",
      fork_turns: "none",
    },
  };
}

describe("Codex adaptive-goal spawn guard", () => {
  test("binds the accepted canonical owner reference without recording helper activation", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-codex-guard-"));
    const objectiveRoot = await mkdtemp(
      join(tmpdir(), "darrow-codex-objective-"),
    );
    try {
      await writeFile(join(repo, "fixture.txt"), "base\n");
      await mkdir(join(repo, ".git"));
      const goalLoopPath = join(repo, "fake-goal-loop");
      await writeFile(goalLoopPath, "#!/bin/sh\nexit 99\n");
      const policy = {
        secret: "secret",
        baselineSha256: await repositoryFingerprint(repo),
        fixtureStateSha256: await fixtureStateFingerprint(repo),
        requestSha256: "4".repeat(64),
        objectiveRoot,
        goalLoopPath,
        statePath: join(repo, ".git", "guard-state"),
      };
      expect(await guardCodexSpawn(hookInput(repo), policy)).toBeDefined();
      const descendant = await guardCodexSpawn(
        {
          hook_event_name: "PostToolUse",
          tool_name: "spawn_agent",
          tool_use_id: "descendant-tool-use",
          turn_id: "descendant-turn",
          cwd: repo,
          tool_input: hookInput(repo).tool_input,
          tool_response: { task_name: "/root/descendant_agent" },
        },
        policy,
      );
      expect(JSON.stringify(descendant)).toContain(
        "not bound to the accepted parent turn",
      );
      const changedInput = await guardCodexSpawn(
        {
          hook_event_name: "PostToolUse",
          tool_name: "spawn_agent",
          tool_use_id: "owner-tool-use",
          turn_id: "parent-turn",
          cwd: repo,
          tool_input: { ...hookInput(repo).tool_input, message: "changed" },
          tool_response: { task_name: "/root/wrong_agent" },
        },
        policy,
      );
      expect(JSON.stringify(changedInput)).toContain(
        "input does not match the accepted spawn",
      );
      for (const taskName of [
        "adaptive_goal_runner",
        "/other/adaptive_goal_runner",
        "/root/../adaptive_goal_runner",
        "/root//adaptive_goal_runner",
        "/root/adaptive-goal-runner",
        "/root/adaptive goal runner",
        "/root/adaptive\tgoal_runner",
        "/root/adaptive\ngoal_runner",
        "/root/adaptive_goal_runner;bad",
      ]) {
        const invalid = await guardCodexSpawn(
          {
            hook_event_name: "PostToolUse",
            tool_name: "spawn_agent",
            tool_use_id: "owner-tool-use",
            turn_id: "parent-turn",
            cwd: repo,
            tool_input: hookInput(repo).tool_input,
            tool_response: { task_name: taskName },
          },
          policy,
        );
        expect(JSON.stringify(invalid)).toContain(
          "response omitted a canonical task_name",
        );
      }
      const recorded = await guardCodexSpawn(
        {
          hook_event_name: "PostToolUse",
          tool_name: "spawn_agent",
          tool_use_id: "owner-tool-use",
          turn_id: "parent-turn",
          cwd: repo,
          tool_input: hookInput(repo).tool_input,
          tool_response: { task_name: "/root/adaptive_goal_runner" },
        },
        policy,
      );
      expect(recorded).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
        },
      });
      expect(JSON.stringify(recorded)).toContain(
        "observed accepted native-subagent reference /root/adaptive_goal_runner",
      );
      expect(JSON.stringify(recorded)).toContain(
        "goal-loop step activate command before waiting",
      );
      expect(
        await verifiedCodexAcceptedAgentRef(policy.statePath, policy.secret),
      ).toBe("/root/adaptive_goal_runner");
      const activation = await guardCodexSpawn(
        {
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          turn_id: "parent-turn",
          cwd: repo,
          tool_input: {
            command:
              `/bin/bash ${goalLoopPath} step activate ` +
              "--ledger /tmp/darrow-goal-run.fixture " +
              "--applied-by native-subagent --boundary native_subagent " +
              "--agent-ref /root/adaptive_goal_runner " +
              "--effective-route 'codex|openai|gpt-5.6-luna|low' " +
              "--route-verified true",
          },
        },
        policy,
      );
      expect(activation).toBeUndefined();
      const wrongAgent = await guardCodexSpawn(
        {
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          turn_id: "parent-turn",
          cwd: repo,
          tool_input: {
            command:
              `/bin/bash ${goalLoopPath} step activate ` +
              "--ledger /tmp/darrow-goal-run.fixture " +
              "--applied-by native-subagent --boundary native_subagent " +
              "--agent-ref /root/other_goal_runner " +
              "--effective-route 'codex|openai|gpt-5.6-luna|low' " +
              "--route-verified true",
          },
        },
        policy,
      );
      expect(JSON.stringify(wrongAgent)).toContain(
        "parent shell commands are forbidden",
      );
      const failedActivationStop = await guardCodexSpawn(
        {
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          turn_id: "parent-turn",
          cwd: repo,
          tool_input: {
            command:
              `/bin/bash ${goalLoopPath} step launch-stop ` +
              "--ledger /tmp/darrow-goal-run.fixture " +
              "--reason launch-unavailable " +
              "--agent-ref /root/adaptive_goal_runner",
          },
        },
        policy,
      );
      expect(failedActivationStop).toBeUndefined();
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
  });

  test("canonicalizes an ownership-marked request to the sole materialized objective", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-codex-guard-"));
    const objectiveRoot = await mkdtemp(
      join(tmpdir(), "darrow-codex-objective-"),
    );
    try {
      await writeFile(join(repo, "fixture.txt"), "base\n");
      await mkdir(join(repo, ".git"));
      const attachmentDir = join(objectiveRoot, "darrow-goal-contract.bound");
      await mkdir(attachmentDir);
      const contractPath = join(attachmentDir, "goal-contract.md");
      const objectivePath = join(attachmentDir, "goal-objective.txt");
      const digest = createHash("sha256").update(contract).digest("hex");
      await writeFile(contractPath, contract);
      await writeFile(
        objectivePath,
        [
          "Before doing any work, read the complete goal contract at:",
          contractPath,
          `Expected SHA-256: ${digest}`,
          "Verify the file digest before following the contract.",
          "If the file is missing, unreadable, or does not match, stop and report the evidence gap.",
          "This accepted ownership-marked task already makes you the sole goal owner; execute the contract directly even when no inner goal-control tool exists.",
          "Follow that complete contract through terminal completion.",
          "",
        ].join("\n"),
      );
      const guarded = await guardCodexSpawn(
        hookInput(
          repo,
          "improvised owner prose that must not reach the runner",
        ),
        {
          secret: "secret",
          baselineSha256: await repositoryFingerprint(repo),
          fixtureStateSha256: await fixtureStateFingerprint(repo),
          requestSha256: "4".repeat(64),
          objectiveRoot,
          goalLoopPath: "/plugin/bin/goal-loop",
          statePath: join(repo, ".git", "guard-state"),
        },
      );
      const message = (
        guarded?.hookSpecificOutput as {
          updatedInput?: { message?: string };
        }
      )?.updatedInput?.message;
      expect(message?.split("\n").slice(0, 2)).toEqual([
        "- phase: adaptive-goal-runner",
        `- objective_file: ${objectivePath}`,
      ]);
      expect(message).not.toContain("improvised owner prose");
      expect(verifiedCodexSpawnAttestation(message!, "secret")).toMatchObject({
        objectiveMode: "file-backed",
        attachmentDir,
        contractSha256: digest,
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
  });

  test("attests the route, objective, and unchanged owner boundary", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-codex-guard-"));
    try {
      await writeFile(join(repo, "fixture.txt"), "base\n");
      await mkdir(join(repo, ".git"));
      const objectiveRoot = await mkdtemp(
        join(tmpdir(), "darrow-codex-objective-"),
      );
      const baseline = await repositoryFingerprint(repo);
      const fixtureState = await fixtureStateFingerprint(repo);
      const input = hookInput(repo);
      delete (input.tool_input as { fork_turns?: string }).fork_turns;
      const guarded = await guardCodexSpawn(input, {
        secret: "secret",
        baselineSha256: baseline,
        fixtureStateSha256: fixtureState,
        requestSha256: "4".repeat(64),
        objectiveRoot,
        goalLoopPath: "/plugin/bin/goal-loop",
        statePath: join(repo, ".git", "guard-state"),
      });
      const updatedInput = (
        guarded?.hookSpecificOutput as {
          updatedInput?: { message?: string; fork_turns?: string };
        }
      )?.updatedInput;
      const message = updatedInput?.message;
      expect(updatedInput?.fork_turns).toBe("none");
      expect(message).toBeString();
      expect(verifiedCodexSpawnAttestation(message!, "secret")).toMatchObject({
        model: "gpt-5.6-luna",
        effort: "low",
        forkTurns: "none",
        requestSha256: "4".repeat(64),
        baselineSha256: baseline,
        fixtureStateSha256: fixtureState,
        objectiveMode: "inline",
        ledger: "/tmp/darrow-goal-run.fixture",
      });
      expect(
        verifiedCodexSpawnAttestation(message!, "wrong-secret"),
      ).toBeUndefined();
      const parentShell = {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        turn_id: "parent-turn",
        cwd: repo,
        tool_input: { command: "bash test.sh" },
      };
      const policy = {
        secret: "secret",
        baselineSha256: baseline,
        fixtureStateSha256: fixtureState,
        requestSha256: "4".repeat(64),
        objectiveRoot,
        goalLoopPath: "/plugin/bin/goal-loop",
        statePath: join(repo, ".git", "guard-state"),
      };
      expect(JSON.stringify(await guardCodexSpawn(input, policy))).toContain(
        "activation was already attempted; retries are forbidden",
      );
      expect(
        JSON.stringify(await guardCodexSpawn(parentShell, policy)),
      ).toContain("forbidden after goal owner activation");
      expect(
        await guardCodexSpawn({ ...parentShell, turn_id: "goal-turn" }, policy),
      ).toBeUndefined();
      expect(
        await guardCodexSpawn(
          {
            ...parentShell,
            tool_input: { command: "feedbackctl answer rounding-mode" },
          },
          policy,
        ),
      ).toBeUndefined();
      const lifecycleShell = (command: string) => ({
        ...parentShell,
        tool_input: { command },
      });
      const observed = await guardCodexSpawn(
        {
          hook_event_name: "PostToolUse",
          tool_name: "spawn_agent",
          tool_use_id: "owner-tool-use",
          turn_id: "parent-turn",
          cwd: repo,
          tool_input: input.tool_input,
          tool_response: { task_name: "/root/adaptive_goal_runner" },
        },
        policy,
      );
      expect(JSON.stringify(observed)).toContain(
        "observed accepted native-subagent reference /root/adaptive_goal_runner",
      );
      expect(
        await guardCodexSpawn(
          lifecycleShell(
            "/bin/bash /plugin/bin/goal-loop step activate " +
              "--ledger /tmp/darrow-goal-run.fixture " +
              "--applied-by native-subagent --boundary native_subagent " +
              "--agent-ref /root/adaptive_goal_runner " +
              "--effective-route 'codex|openai|gpt-5.6-luna|low' " +
              "--route-verified true",
          ),
          policy,
        ),
      ).toBeUndefined();
      expect(
        await guardCodexSpawn(
          lifecycleShell(
            "/bin/bash /plugin/bin/goal-loop step report " +
              "--ledger /tmp/darrow-goal-run.fixture --status complete " +
              "--human-interruptions 0",
          ),
          policy,
        ),
      ).toBeUndefined();
      expect(
        JSON.stringify(
          await guardCodexSpawn(
            lifecycleShell(
              "/bin/bash /plugin/bin/goal-loop step activate " +
                "--ledger /tmp/darrow-goal-run.fixture " +
                "--applied-by native-subagent --boundary native_subagent " +
                "--agent-ref /root/adaptive_goal_runner " +
                "--effective-route 'codex|openai|gpt-5.6-sol|high' " +
                "--route-verified true",
            ),
            policy,
          ),
        ),
      ).toContain("forbidden after goal owner activation");
      expect(
        JSON.stringify(
          await guardCodexSpawn(
            {
              ...parentShell,
              tool_name: "spawn_agent",
              tool_input: { message: "unmarked helper" },
            },
            policy,
          ),
        ),
      ).toContain("ownership-marked");
      await rm(objectiveRoot, { recursive: true, force: true });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  test("denies parent mutations, marker-only tasks, and incomplete routes", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-codex-guard-"));
    try {
      await writeFile(join(repo, "fixture.txt"), "base\n");
      await mkdir(join(repo, ".git"));
      const objectiveRoot = await mkdtemp(
        join(tmpdir(), "darrow-codex-objective-"),
      );
      const baseline = await repositoryFingerprint(repo);
      const fixtureState = await fixtureStateFingerprint(repo);
      const policy = {
        secret: "secret",
        baselineSha256: baseline,
        fixtureStateSha256: fixtureState,
        requestSha256: "4".repeat(64),
        objectiveRoot,
        goalLoopPath: "/plugin/bin/goal-loop",
        statePath: join(repo, ".git", "guard-state"),
      };
      const preflightTest = await guardCodexSpawn(
        {
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          turn_id: "parent-turn",
          cwd: repo,
          tool_input: { command: "bash test.sh" },
        },
        policy,
      );
      expect(JSON.stringify(preflightTest)).toContain("before activation");
      const stagingFile = join(objectiveRoot, "goal.md");
      expect(
        await guardCodexSpawn(
          {
            hook_event_name: "PreToolUse",
            tool_name: "apply_patch",
            turn_id: "parent-turn",
            cwd: repo,
            tool_input: {
              command: `*** Begin Patch\n*** Add File: ${stagingFile}\n+contract\n*** End Patch`,
            },
          },
          policy,
        ),
      ).toBeUndefined();
      expect(
        JSON.stringify(
          await guardCodexSpawn(
            {
              hook_event_name: "PreToolUse",
              tool_name: "apply_patch",
              turn_id: "parent-turn",
              cwd: repo,
              tool_input: {
                command: `*** Begin Patch\n*** Add File: ${join(repo, "product.js")}\n+bad\n*** End Patch`,
              },
            },
            policy,
          ),
        ),
      ).toContain("private objective staging file");
      await writeFile(join(repo, "fixture.txt"), "parent edit\n");
      const changed = await guardCodexSpawn(hookInput(repo), {
        secret: "secret",
        baselineSha256: baseline,
        fixtureStateSha256: fixtureState,
        requestSha256: "4".repeat(64),
        objectiveRoot,
        goalLoopPath: "/plugin/bin/goal-loop",
        statePath: join(repo, ".git", "guard-state"),
      });
      expect(JSON.stringify(changed)).toContain("worktree changed");

      const current = await repositoryFingerprint(repo);
      const markerOnly = await guardCodexSpawn(
        hookInput(repo, "not a complete contract"),
        {
          secret: "secret",
          baselineSha256: current,
          fixtureStateSha256: fixtureState,
          requestSha256: "4".repeat(64),
          objectiveRoot,
          goalLoopPath: "/plugin/bin/goal-loop",
          statePath: join(repo, ".git", "guard-state"),
        },
      );
      expect(JSON.stringify(markerOnly)).toContain(
        "invalid fields: contract_labels",
      );

      const missingReadiness = await guardCodexSpawn(
        hookInput(
          repo,
          contract
            .split("\n")
            .filter((line) => !line.startsWith("Readiness gate:"))
            .join("\n"),
        ),
        {
          secret: "secret",
          baselineSha256: current,
          fixtureStateSha256: fixtureState,
          requestSha256: "4".repeat(64),
          objectiveRoot,
          goalLoopPath: "/plugin/bin/goal-loop",
          statePath: join(repo, ".git", "guard-state"),
        },
      );
      expect(JSON.stringify(missingReadiness)).toContain(
        "invalid fields: contract_labels",
      );

      const internalRecord = await guardCodexSpawn(
        hookInput(repo, `${contract}\nformat\tdarrow-goal-step-v1`),
        {
          secret: "secret",
          baselineSha256: current,
          fixtureStateSha256: fixtureState,
          requestSha256: "4".repeat(64),
          objectiveRoot,
          goalLoopPath: "/plugin/bin/goal-loop",
          statePath: join(repo, ".git", "guard-state"),
        },
      );
      expect(JSON.stringify(internalRecord)).toContain(
        "invalid fields: internal_goal_record",
      );

      const missingEffort = hookInput(repo);
      delete (missingEffort.tool_input as { reasoning_effort?: string })
        .reasoning_effort;
      const incomplete = await guardCodexSpawn(missingEffort, {
        secret: "secret",
        baselineSha256: current,
        fixtureStateSha256: fixtureState,
        requestSha256: "4".repeat(64),
        objectiveRoot,
        goalLoopPath: "/plugin/bin/goal-loop",
        statePath: join(repo, ".git", "guard-state"),
      });
      expect(JSON.stringify(incomplete)).toContain("concrete model and effort");

      const conflictingFork = hookInput(repo);
      (conflictingFork.tool_input as { fork_turns: string }).fork_turns = "all";
      const rejectedFork = await guardCodexSpawn(conflictingFork, {
        secret: "secret",
        baselineSha256: current,
        fixtureStateSha256: fixtureState,
        requestSha256: "4".repeat(64),
        objectiveRoot,
        goalLoopPath: "/plugin/bin/goal-loop",
        statePath: join(repo, ".git", "guard-state"),
      });
      expect(JSON.stringify(rejectedFork)).toContain("conflicting fork_turns");

      await writeFile(
        join(repo, ".git", "independent-review-invocations"),
        "premature\n",
      );
      const changedFixture = await guardCodexSpawn(hookInput(repo), {
        secret: "secret",
        baselineSha256: current,
        fixtureStateSha256: fixtureState,
        requestSha256: "4".repeat(64),
        objectiveRoot,
        goalLoopPath: "/plugin/bin/goal-loop",
        statePath: join(repo, ".git", "guard-state"),
      });
      expect(JSON.stringify(changedFixture)).toContain("fixture state changed");
      await rm(objectiveRoot, { recursive: true, force: true });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});
