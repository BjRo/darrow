import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  fixtureStateFingerprint,
  guardCodexSpawn,
  repositoryFingerprint,
  verifiedCodexAcceptedOwner,
  verifiedCodexSpawnAttestation,
} from "./codex-spawn-guard";

const contract = [
  "Role: You are the already-launched sole engineering owner. Perform this contract directly; do not invoke adaptive-goal or seek another owner.",
  "Outcome: Implement the requested fixture behavior.",
  "Acceptance criteria: The requested behavior and checks pass.",
  "Scope and authority: included=fixture implementation and focused tests; authorized=local edits and checks only; forbidden=publication; preserve=unrelated repository state",
  "Execution: workflow=implement-feature; sequence=inspect fixture, implement behavior, run checks; risk=routine; profile=routine; route=codex|openai|gpt-5.6-luna|low; capabilities=none",
  "Verification and gates: readiness=not required; review=not required; focused=run the focused test; final=run the repository gate; feedback=return the smallest complete question; blockers=return concrete evidence and the smallest next action",
  "Completion evidence: report status, files, checks, and remaining risks.",
].join("\n");
const ownerId = "01a04f35-c37a-74b3-baa4-961bc21b6f49";

function ownerHook(cwd: string, message = contract) {
  return {
    hook_event_name: "PreToolUse",
    tool_use_id: "owner-tool-use",
    turn_id: "parent-turn",
    cwd,
    tool_name: "spawn_agent",
    tool_input: {
      task_name: "adaptive_goal_fixture",
      message: `- phase: adaptive-goal-owner\n${message}`,
      model: "gpt-5.6-luna",
      reasoning_effort: "low",
      fork_turns: "none",
    },
  };
}

async function fixture() {
  const repo = await mkdtemp(join(tmpdir(), "darrow-codex-guard-"));
  const objectiveRoot = await mkdtemp(
    join(tmpdir(), "darrow-codex-objective-"),
  );
  await writeFile(join(repo, "fixture.txt"), "base\n");
  await mkdir(join(repo, ".git", "fixture-state"), { recursive: true });
  return {
    repo,
    objectiveRoot,
    policy: {
      secret: "secret",
      baselineSha256: await repositoryFingerprint(repo),
      fixtureStateSha256: await fixtureStateFingerprint(repo),
      requestSha256: "4".repeat(64),
      objectiveRoot,
      goalLoopPath: "/plugin/bin/goal-loop",
      statePath: join(repo, ".git", "guard-state"),
    },
  };
}

describe("Codex adaptive-goal spawn guard", () => {
  test("accepts one inline routed owner and binds its canonical reference", async () => {
    const { repo, objectiveRoot, policy } = await fixture();
    try {
      const guarded = await guardCodexSpawn(ownerHook(repo), policy);
      expect(guarded).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          updatedInput: { fork_turns: "none" },
        },
      });
      const updated = (
        guarded?.hookSpecificOutput as {
          updatedInput?: { message?: string };
        }
      ).updatedInput;
      expect(updated?.message).toBe(
        `- phase: adaptive-goal-owner\n${contract}`,
      );
      expect(
        verifiedCodexSpawnAttestation(updated!.message!, "secret"),
      ).toBeUndefined();

      expect(
        await verifiedCodexAcceptedOwner(
          policy.statePath,
          policy.secret,
          ownerId,
        ),
      ).toMatchObject({
        agentRef: ownerId,
        model: "gpt-5.6-luna",
        effort: "low",
        workflow: "implement-feature",
        risk: "routine",
        profile: "routine",
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
  });

  test("compares the selected route semantically across human-readable forms", async () => {
    for (const [index, selectedRoute] of [
      "codex | openai | gpt-5.6-luna | low (bundled policy).",
      "`codex/openai/gpt-5.6-luna/low` via bundled policy.",
    ].entries()) {
      const { repo, objectiveRoot, policy } = await fixture();
      try {
        const message = contract.replace(
          "codex|openai|gpt-5.6-luna|low.",
          selectedRoute,
        );
        const hook = ownerHook(repo, message);
        if (index === 1)
          delete (hook.tool_input as { task_name?: string }).task_name;
        expect(await guardCodexSpawn(hook, policy)).toMatchObject({
          hookSpecificOutput: { permissionDecision: "allow" },
        });
        if (index === 1)
          expect(
            await verifiedCodexAcceptedOwner(
              policy.statePath,
              policy.secret,
              ownerId,
            ),
          ).toMatchObject({ agentRef: ownerId });
      } finally {
        await rm(repo, { recursive: true, force: true });
        await rm(objectiveRoot, { recursive: true, force: true });
      }
    }
  });

  test("accepts descriptive dimensions while normalizing the risk", async () => {
    const { repo, objectiveRoot, policy } = await fixture();
    try {
      const descriptive = contract.replace(
        "workflow=implement-feature; sequence=inspect fixture, implement behavior, run checks; risk=routine; profile=routine;",
        "workflow=custom-delivery; sequence=inspect fixture, implement behavior, run checks; risk=Elevated migration; profile=focused;",
      );
      expect(
        await guardCodexSpawn(ownerHook(repo, descriptive), policy),
      ).toMatchObject({
        hookSpecificOutput: { permissionDecision: "allow" },
      });
      expect(
        await verifiedCodexAcceptedOwner(
          policy.statePath,
          policy.secret,
          ownerId,
        ),
      ).toMatchObject({
        workflow: "custom-delivery",
        risk: "elevated",
        profile: "focused",
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
  });

  test("rejects malformed owner boundaries and removed lifecycle protocol", async () => {
    for (const mutate of [
      (input: ReturnType<typeof ownerHook>) => {
        delete (input.tool_input as { model?: string }).model;
      },
      (input: ReturnType<typeof ownerHook>) => {
        input.tool_input.fork_turns = "all";
      },
      (input: ReturnType<typeof ownerHook>) => {
        input.tool_input.message = "- phase: adaptive-goal-owner\nshort";
      },
      (input: ReturnType<typeof ownerHook>) => {
        input.tool_input.message = input.tool_input.message.replace(
          "sequence=inspect fixture, implement behavior, run checks; ",
          "",
        );
      },
      (input: ReturnType<typeof ownerHook>) => {
        input.tool_input.message += "\nProtocol ledger: /tmp/legacy";
      },
      (input: ReturnType<typeof ownerHook>) => {
        input.tool_input.message = input.tool_input.message.replace(
          "gpt-5.6-luna|low",
          "gpt-5.6-terra|medium",
        );
      },
    ]) {
      const { repo, objectiveRoot, policy } = await fixture();
      try {
        const input = ownerHook(repo);
        mutate(input);
        const result = await guardCodexSpawn(input, policy);
        expect(result).toMatchObject({
          hookSpecificOutput: { permissionDecision: "deny" },
        });
      } finally {
        await rm(repo, { recursive: true, force: true });
        await rm(objectiveRoot, { recursive: true, force: true });
      }
    }
  });

  test("keeps classifier mutation and verification read-only", async () => {
    const { repo, objectiveRoot, policy } = await fixture();
    try {
      const testResult = await guardCodexSpawn(
        {
          hook_event_name: "PreToolUse",
          turn_id: "parent-turn",
          cwd: repo,
          tool_name: "Bash",
          tool_input: { command: "bash test.sh" },
        },
        policy,
      );
      expect(JSON.stringify(testResult)).toContain(
        "classifier cannot execute verification",
      );
      const patchResult = await guardCodexSpawn(
        {
          hook_event_name: "PreToolUse",
          turn_id: "parent-turn",
          cwd: repo,
          tool_name: "apply_patch",
          tool_input: {
            command:
              "*** Begin Patch\n*** Add File: product.txt\n+x\n*** End Patch",
          },
        },
        policy,
      );
      expect(JSON.stringify(patchResult)).toContain("classifier is read-only");
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
  });

  test("leaves post-activation ownership attribution to transcript evidence", async () => {
    const { repo, objectiveRoot, policy } = await fixture();
    try {
      await guardCodexSpawn(ownerHook(repo), policy);
      const shell = {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        turn_id: "parent-turn",
        cwd: repo,
        tool_input: { command: "git status" },
      };
      expect(await guardCodexSpawn(shell, policy)).toBeUndefined();
      expect(
        await guardCodexSpawn(
          {
            ...shell,
            turn_id: "owner-operation-turn",
            agent_id: ownerId,
            agent_type: "adaptive_goal_fixture",
          },
          policy,
        ),
      ).toBeUndefined();
      expect(
        await guardCodexSpawn(
          { ...shell, turn_id: "/root/later_parent_turn" },
          policy,
        ),
      ).toBeUndefined();
      const unmarkedSpawn = {
        hook_event_name: "PreToolUse",
        tool_name: "spawn_agent",
        turn_id: "/root/later_parent_turn",
        cwd: repo,
        tool_input: {
          task_name: "replacement_owner",
          message: "unmarked replacement task",
        },
      };
      expect(await guardCodexSpawn(unmarkedSpawn, policy)).toBeUndefined();
      expect(
        await guardCodexSpawn(
          {
            ...unmarkedSpawn,
            turn_id: "owner-delegation-turn",
            agent_id: ownerId,
            agent_type: "adaptive_goal_fixture",
          },
          policy,
        ),
      ).toBeUndefined();
      expect(
        await guardCodexSpawn(
          {
            ...unmarkedSpawn,
            turn_id: ownerId,
            agent_id: "01a04f35-c37a-74b3-baa4-961bc21b6f40",
            agent_type: "other_agent",
          },
          policy,
        ),
      ).toBeUndefined();
      expect(
        JSON.stringify(await guardCodexSpawn(ownerHook(repo), policy)),
      ).toContain("activation was already attempted");
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
  });

  test("rejects launch after parent or fixture state changes", async () => {
    for (const mutate of [
      async (repo: string) => writeFile(join(repo, "fixture.txt"), "changed\n"),
      async (repo: string) =>
        writeFile(join(repo, ".git", "fixture-log"), "changed\n"),
    ]) {
      const { repo, objectiveRoot, policy } = await fixture();
      try {
        await mutate(repo);
        const result = await guardCodexSpawn(ownerHook(repo), policy);
        expect(JSON.stringify(result)).toMatch(
          /worktree changed|fixture state changed/,
        );
      } finally {
        await rm(repo, { recursive: true, force: true });
        await rm(objectiveRoot, { recursive: true, force: true });
      }
    }
  });

  test("permits readiness trace output before owner launch", async () => {
    const { repo, objectiveRoot, policy } = await fixture();
    try {
      await mkdir(join(repo, ".git", "fixture-state"), { recursive: true });
      await writeFile(
        join(
          repo,
          ".git",
          "fixture-state",
          "implementation-readiness-invocations",
        ),
        "ready\n",
      );
      await writeFile(
        join(
          repo,
          ".git",
          "fixture-state",
          "implementation-readiness-pre-status",
        ),
        "",
      );
      const result = await guardCodexSpawn(ownerHook(repo), policy);
      expect(result).toMatchObject({
        hookSpecificOutput: { permissionDecision: "allow" },
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
  });

  test("rejects other fixture-state changes before owner launch", async () => {
    const { repo, objectiveRoot, policy } = await fixture();
    try {
      await mkdir(join(repo, ".git", "fixture-state"), { recursive: true });
      await writeFile(
        join(repo, ".git", "fixture-state", "unexpected-operation"),
        "changed\n",
      );
      const result = await guardCodexSpawn(ownerHook(repo), policy);
      expect(JSON.stringify(result)).toContain(
        "parent fixture state changed before adaptive goal owner activation",
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
  });
});
