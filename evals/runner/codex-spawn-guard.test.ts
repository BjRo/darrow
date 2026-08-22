import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  guardCodexSpawn,
  fixtureStateFingerprint,
  repositoryFingerprint,
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
  "Independent review: selected — high-risk final-tree review is required.",
  "Stopping budget: No user-specified numeric limit.",
  "Human feedback: Pause mutation and ask one smallest material question.",
  "Completion report: Begin terminal output with the canonical report.",
  "format\tdarrow-native-goal-preflight-v4",
  "workflow\tchange-feature",
  "risk\thigh",
  "profile\troutine",
  "selected_route\tcodex\topenai\tgpt-5.6-luna\tlow",
  "effective_route\tcodex\topenai\tgpt-5.6-luna\tlow",
  "route_applied_by\tnative-subagent",
  "route_verified\ttrue",
  "launch_boundary\tnative_subagent",
  "verification_gate\thigh",
  "evaluation_child_invocations\t1",
  "evaluation_human_interruptions\t0",
].join("\n");

function hookInput(cwd: string, message = contract) {
  return {
    hook_event_name: "PreToolUse",
    turn_id: "parent-turn",
    cwd,
    tool_name: "Agent",
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
      expect(
        JSON.stringify(
          await guardCodexSpawn(
            {
              ...parentShell,
              tool_name: "Agent",
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
