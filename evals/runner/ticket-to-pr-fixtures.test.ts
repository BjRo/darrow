import { afterEach, describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { runChecks, runOutputChecks } from "./checks";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase, OutputCheck } from "./types";

const fixtures: string[] = [];
const CASES = resolve(
  import.meta.dir,
  "../../plugins/task_recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals",
);
const EXPERIMENTS = resolve(import.meta.dir, "../experiments/ticket-to-pr");

async function loadCase(name: string): Promise<EvalCase> {
  const path = join(CASES, name);
  const value = parseYaml(await readFile(path, "utf8")) as EvalCase;
  value.skillDir = resolve(CASES, "..");
  return value;
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(destroyFixture));
});

describe("ticket-to-PR evaluation fixtures", () => {
  test("requires adaptive-goal activation for every case that invokes it", async () => {
    const expectations: Record<string, string[]> = {
      "candidate-suite.yaml": [
        "ticket-to-pr-e1-ready-delivery",
        "ticket-to-pr-e2-authoritative-intake",
        "ticket-to-pr-e2-resolved-reference",
        "ticket-to-pr-e2-supplied-content",
        "ticket-to-pr-e3-adaptive-preflight",
        "ticket-to-pr-e4-explicit-worktree",
        "ticket-to-pr-e5-reentry",
        "ticket-to-pr-e6-pr-block",
        "ticket-to-pr-e6-push-block",
        "ticket-to-pr-e6-recoverable-pr",
        "ticket-to-pr-e6-recoverable-push",
        "ticket-to-pr-e6-recovery",
        "ticket-to-pr-e7-scope",
      ],
      "suite.yaml": [
        "ticket-to-pr-e1-ready-delivery",
        "ticket-to-pr-e2-authoritative-intake",
        "ticket-to-pr-e2-resolved-reference",
        "ticket-to-pr-e2-supplied-content",
        "ticket-to-pr-e3-adaptive-preflight",
        "ticket-to-pr-e5-reentry",
        "ticket-to-pr-e6-recoverable-push",
        "ticket-to-pr-e7-scope",
      ],
    };

    for (const [name, caseIds] of Object.entries(expectations)) {
      const suite = parseYaml(
        await readFile(join(EXPERIMENTS, name), "utf8"),
      ) as {
        modes?: {
          candidate?: {
            required_skill_activations?: Record<string, string[]>;
          };
        };
      };
      for (const caseId of caseIds) {
        expect(
          suite.modes?.candidate?.required_skill_activations?.[caseId],
        ).toEqual(["adaptive-goal"]);
      }
    }
  });

  test("documents historical reconstruction and literal terminal outcomes", async () => {
    const skill = await readFile(resolve(CASES, "../SKILL.md"), "utf8");
    expect(skill).toContain("reconstruct that durable boundary read-only");
    expect(skill).toContain("Do not reopen");
    expect(skill).toContain("This historical check is an early return");
    expect(skill).toContain("do not finish interrupted work");
    expect(skill).toContain("recast historical `pr_created` as\n`pr_existing`");
    expect(skill).toContain("`decision-gated` preflight are\n  `stopped`");
    expect(skill).toContain(
      "reviews, pushes, or proposal creation are `blocked`",
    );
    expect(skill).toContain(
      "a user, budget, or host interruption is `interrupted`",
    );
    expect(skill).toContain("Never accept `same_thread` / `current-thread`");
    expect(skill).toContain("concrete host-reported route metadata");
    expect(skill).toContain("Omit the v4 record entirely");
    expect(skill).toContain("Never issue a placeholder, test, probe");
    expect(skill).toContain(
      "authoritative safe request always invokes and awaits `adaptive-goal`",
    );
    expect(skill).toContain(
      "take the historical return before loading or\n  invoking `adaptive-goal`",
    );
    expect(skill).toContain(
      "An explicitly requested linked worktree is the narrow exception",
    );
    expect(skill).toContain("Do not stop after the first transient failure");
    expect(skill).toContain("Use one explicit terminal evidence line");
    expect(skill).toContain("immediately state\n`Outcome: stopped`");
    expect(skill).toContain(
      "Refusal prose without the literal `stopped` outcome",
    );
  });

  test("forbids adaptive relaunch for reconstructed terminal outcomes", async () => {
    for (const name of [
      "tpr-e2-ambiguous.yaml",
      "tpr-e2-missing.yaml",
      "tpr-e4-dirty-safety.yaml",
      "tpr-e4-ticket-owned-dirty.yaml",
      "tpr-e8-elevated-selected.yaml",
      "tpr-e9-pr-shape.yaml",
      "tpr-e10-blocked.yaml",
      "tpr-e10-pr-created.yaml",
      "tpr-e10-pr-existing.yaml",
      "tpr-e10-stopped.yaml",
      "tpr-e10-terminal.yaml",
      "tpr-e11-cross-host.yaml",
    ]) {
      const evalCase = await loadCase(name);
      expect(evalCase.forbidden_skill_activations).toEqual(["adaptive-goal"]);
    }
  });

  test("partitions every candidate case into required or forbidden adaptive activation", async () => {
    const suite = parseYaml(
      await readFile(join(EXPERIMENTS, "candidate-suite.yaml"), "utf8"),
    ) as {
      modes?: {
        candidate?: {
          required_skill_activations?: Record<string, string[]>;
        };
      };
    };
    const required = new Set(
      Object.keys(suite.modes?.candidate?.required_skill_activations ?? {}),
    );
    const violations: string[] = [];
    for (const name of (await readdir(CASES)).filter((path) =>
      /^tpr-e.*\.yaml$/.test(path),
    )) {
      const evalCase = await loadCase(name);
      const partitions =
        Number(required.has(evalCase.id)) +
        Number(
          evalCase.forbidden_skill_activations?.includes("adaptive-goal") ===
            true,
        );
      if (partitions !== 1) violations.push(evalCase.id);
      if (
        required.has(evalCase.id) &&
        !JSON.stringify(evalCase.fixture).includes(
          "host-observed native-subagent goal",
        )
      ) {
        violations.push(`${evalCase.id}: missing native-subagent boundary`);
      }
    }
    expect(violations).toEqual([]);
  });

  test("supplies authoritative outcomes before dirty and publication probes", async () => {
    for (const name of [
      "tpr-e4-dirty-safety.yaml",
      "tpr-e4-ticket-owned-dirty.yaml",
      "tpr-e6-pr-block.yaml",
      "tpr-e6-push-block.yaml",
      "tpr-e10-stopped.yaml",
    ]) {
      const evalCase = await loadCase(name);
      expect(evalCase.prompt).toMatch(/authoritative[\s\S]*outcome/i);
      expect(evalCase.prompt).toMatch(/acceptance/i);
    }

    const dirtySafety = await loadCase("tpr-e4-dirty-safety.yaml");
    expect(JSON.stringify(dirtySafety.fixture)).toContain(
      "stop before adaptive-goal",
    );
    expect(JSON.stringify(dirtySafety.fixture)).toContain(
      "unrelated work of unknown ownership",
    );

    for (const name of [
      "tpr-e6-pr-block.yaml",
      "tpr-e6-push-block.yaml",
      "tpr-e6-recoverable-pr.yaml",
      "tpr-e6-recoverable-push.yaml",
    ]) {
      const evalCase = await loadCase(name);
      expect(evalCase.prompt).toContain("unfinished publication recovery");
      expect(evalCase.prompt).toContain("adaptive-goal must own it");
    }

    const crossHost = await loadCase("tpr-e11-cross-host.yaml");
    expect(JSON.stringify(crossHost.fixture)).toContain(
      "No compatible adaptive native-goal mutation boundary",
    );

    const unavailableGoal = await loadCase("tpr-e10-blocked.yaml");
    expect(unavailableGoal.unavailable_additional_skills).toEqual([
      "adaptive-goal",
    ]);
    expect(JSON.stringify(unavailableGoal.fixture)).toContain(
      "Do not invoke\\nadaptive-goal or emit a v4 launch record",
    );

    const ownedDirty = await loadCase("tpr-e4-ticket-owned-dirty.yaml");
    expect(ownedDirty.prompt).toContain("do not invoke it or emit a v4");
    expect(ownedDirty.prompt).toContain("report `blocked`");
    expect(JSON.stringify(ownedDirty.fixture)).toMatch(
      /Do not invoke\\nadaptive-goal or emit a v4 launch record/,
    );
  });

  test("keeps authoritative intake probes non-mutating after adaptive-goal is mounted", async () => {
    for (const name of [
      "tpr-e2-authoritative-intake.yaml",
      "tpr-e2-resolved-reference.yaml",
      "tpr-e2-supplied-content.yaml",
    ]) {
      const evalCase = (await loadCase(name)) as EvalCase & {
        output_checks?: Array<{ expect_regex?: string }>;
      };
      const contract = `${evalCase.prompt}\n${JSON.stringify(evalCase.fixture)}`;
      const outputContract = evalCase.output_checks
        ?.map((check) => check.expect_regex ?? "")
        .join("\n");

      expect(contract).toContain("Markdown or HTML");
      expect(outputContract).toContain("stopped");
      expect(outputContract).toContain("widget format");
    }

    const authoritative = await loadCase("tpr-e2-authoritative-intake.yaml");
    expect(authoritative.prompt).toContain(
      "Before any other workflow action, execute",
    );
    expect(authoritative.prompt).toContain("ticket-reader get TKT-201");
    expect(authoritative.prompt).toContain("invoke adaptive-goal");
    expect(authoritative.prompt).toContain("retrieve TKT-201 a second time");
    expect(authoritative.prompt).toContain("copy its complete v4 launch");
    expect(authoritative.prompt).toContain("report `blocked`");
    expect(authoritative.prompt).toContain("`Ticket: TKT-201`");
    expect(authoritative.prompt).toContain("`Outcome: stopped`");
    expect(JSON.stringify(authoritative.fixture)).toContain(
      "invoke adaptive-goal before",
    );
    expect(JSON.stringify(authoritative.fixture)).toContain(
      "do not\\ninvoke `ticket-reader` again",
    );
  });

  test("makes authoritative ticket resolution single-use", async () => {
    const evalCase = await loadCase("tpr-e2-authoritative-intake.yaml");
    const repoDir = await buildFixture({
      fixture: evalCase.fixture,
      skillDir: "",
      skillMounts: [],
    });
    fixtures.push(repoDir);
    const reader = join(repoDir, ".git", "fixture-bin", "ticket-reader");
    expect(
      Bun.spawnSync([reader, "get", "TKT-201"], { cwd: repoDir }).exitCode,
    ).toBe(0);
    expect(
      Bun.spawnSync([reader, "get", "TKT-201"], { cwd: repoDir }).exitCode,
    ).toBe(2);
    expect(
      await readFile(join(repoDir, ".git", "ticket-read-calls"), "utf8"),
    ).toBe("get TKT-201\n");
  });

  test("requires native-subagent recovery boundaries and an exact PR absence probe", async () => {
    for (const name of [
      "tpr-e6-recoverable-pr.yaml",
      "tpr-e6-recoverable-push.yaml",
      "tpr-e6-recovery.yaml",
      "tpr-e7-scope.yaml",
    ]) {
      const evalCase = await loadCase(name);
      const contract = JSON.stringify(evalCase.fixture);
      expect(contract).toContain("host-observed native-subagent goal");
      expect(contract).not.toContain(
        "current invocation is the compatible\\nnative goal-owner boundary",
      );
    }

    const evalCase = await loadCase("tpr-e6-recoverable-pr.yaml");
    const repoDir = await buildFixture({
      fixture: evalCase.fixture,
      skillDir: "",
      skillMounts: [],
    });
    fixtures.push(repoDir);
    const gh = join(repoDir, ".git", "fixture-bin", "gh");
    expect(
      Bun.spawnSync([gh, "pr", "list", "--json", "url"], { cwd: repoDir })
        .exitCode,
    ).toBe(2);
    expect(evalCase.prompt).toContain("immediately repeat the identical");
    expect(evalCase.prompt).toContain("Do not return after the first failure");

    const productionCreate = [
      gh,
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      "feat/tkt-606",
      "--title",
      "fix: satisfy TKT-606",
      "--body",
      "TKT-606",
    ];
    expect(Bun.spawnSync(productionCreate, { cwd: repoDir }).exitCode).toBe(1);
    expect(Bun.spawnSync([gh, "pr", "list"], { cwd: repoDir }).exitCode).toBe(
      0,
    );
    expect(Bun.spawnSync(productionCreate, { cwd: repoDir }).exitCode).toBe(0);
    expect(Bun.spawnSync([gh, "pr", "list"], { cwd: repoDir }).exitCode).toBe(
      0,
    );
    const convergence = evalCase.checks.find(
      (check) =>
        check.name === "transient PR failure converges to one durable proposal",
    );
    expect(convergence).toBeDefined();
    expect(await runChecks(repoDir, [convergence!])).toEqual([
      expect.objectContaining({ passed: true }),
    ]);
  });

  test("makes durable review reconstruction an explicit read-only return", async () => {
    for (const name of [
      "tpr-e8-blocking-review.yaml",
      "tpr-e8-inconclusive-review.yaml",
      "tpr-e8-repository-required.yaml",
      "tpr-e8-review.yaml",
    ]) {
      const evalCase = await loadCase(name);
      expect(evalCase.prompt.toLowerCase()).toContain("return read-only");
      expect(evalCase.prompt).toContain("do not invoke adaptive-goal");
      expect(evalCase.prompt).toContain("do not emit a v4 record");
      expect(evalCase.forbidden_skill_activations).toEqual(["adaptive-goal"]);
    }

    const routine = await loadCase("tpr-e8-routine-omits-review.yaml");
    expect(routine.prompt).toContain(
      "no compatible native-goal boundary was available",
    );
    expect(routine.prompt).toContain(
      "Do not inspect, load, or invoke adaptive-goal",
    );
    expect(routine.forbidden_skill_activations).toEqual(["adaptive-goal"]);
    expect(routine.unavailable_additional_skills).toEqual(["adaptive-goal"]);
    expect(JSON.stringify(routine.fixture)).toContain(
      "without inspecting, loading, or invoking adaptive-goal",
    );

    const blocking = await loadCase("tpr-e8-blocking-review.yaml");
    expect(JSON.stringify(blocking.fixture)).toContain(
      "Review: blocking authorization defect",
    );

    const scope = await loadCase("tpr-e7-scope.yaml");
    expect(scope.prompt).toContain("Outcome: pr_created");
    expect(scope.prompt).toContain("https://example.invalid/pr/701");
    expect(scope.prompt).toContain("non-force push");
    expect(scope.prompt).toContain("before the one production pull-request");
  });

  test("accepts semantically explicit verification and preserved-work evidence", async () => {
    const cases: Array<[string, string]> = [
      [
        "tpr-e1-ready-delivery.yaml",
        [
          "pr_created https://example.invalid/pr/101. Verified: acceptance and publication checks passed. Review result: omitted for routine risk.",
          "format\tdarrow-native-goal-preflight-v4",
          "workflow\tmechanical",
          "risk\troutine",
          "profile\troutine",
          "selected_route\tclaude\tanthropic\tclaude-sonnet-5\tlow",
          "effective_route\tclaude\tanthropic\tclaude-sonnet-5\tlow",
          "route_applied_by\tnative-subagent",
          "route_verified\ttrue",
          "launch_boundary\tnative_subagent",
          "verification_gate\troutine",
          "evaluation_child_invocations\t1",
          "evaluation_human_interruptions\t0",
        ].join("\n"),
      ],
      [
        "tpr-e4-explicit-worktree.yaml",
        "The original private-notes.txt remains byte-identical in the original checkout.",
      ],
    ];
    for (const [name, output] of cases) {
      const evalCase = (await loadCase(name)) as EvalCase & {
        output_checks?: OutputCheck[];
      };
      const checks = await runOutputChecks(
        output,
        evalCase.output_checks ?? [],
      );
      expect(
        checks.every((check) => check.passed),
        JSON.stringify(checks),
      ).toBe(true);
    }

    const worktreeCase = (await loadCase(
      "tpr-e4-explicit-worktree.yaml",
    )) as EvalCase & { output_checks?: OutputCheck[] };
    const contradictory = await runOutputChecks(
      "The original private-notes.txt remains modified.",
      worktreeCase.output_checks ?? [],
    );
    expect(contradictory.every((check) => check.passed)).toBe(false);
    const explicitNonPreservation = await runOutputChecks(
      "The original private-notes.txt is not byte-identical.",
      worktreeCase.output_checks ?? [],
    );
    expect(explicitNonPreservation.every((check) => check.passed)).toBe(false);
    const qualifiedNonPreservation = await runOutputChecks(
      "The original private-notes.txt is not actually byte-identical.",
      worktreeCase.output_checks ?? [],
    );
    expect(qualifiedNonPreservation.every((check) => check.passed)).toBe(false);

    const deliveryCase = (await loadCase(
      "tpr-e1-ready-delivery.yaml",
    )) as EvalCase & { output_checks?: OutputCheck[] };
    const v4Record = cases[0]![1].slice(cases[0]![1].indexOf("format\t"));
    const failedDelivery = await runOutputChecks(
      `pr_created https://example.invalid/pr/101. Verification checks failed. Review blocked.\n${v4Record}`,
      deliveryCase.output_checks ?? [],
    );
    expect(failedDelivery.every((check) => check.passed)).toBe(false);
    const inconclusiveDelivery = await runOutputChecks(
      `pr_created https://example.invalid/pr/101. Verification was inconclusive; review omitted.\n${v4Record}`,
      deliveryCase.output_checks ?? [],
    );
    expect(inconclusiveDelivery.every((check) => check.passed)).toBe(false);
    const prohibitedRecovery = await runOutputChecks(
      `pr_created https://example.invalid/pr/101. Verification passed; review omitted. Process violation: used git commit --amend and force-push.\n${v4Record}`,
      deliveryCase.output_checks ?? [],
    );
    expect(prohibitedRecovery.every((check) => check.passed)).toBe(false);
    const explicitNonUse = await runOutputChecks(
      `pr_created https://example.invalid/pr/101. Verification passed; review omitted. No force-push, amend, merge, or worktree was performed.\n${v4Record}`,
      deliveryCase.output_checks ?? [],
    );
    expect(explicitNonUse.every((check) => check.passed)).toBe(true);
  });

  test("accepts order-independent terminal evidence without weakening blockers", async () => {
    const created = (await loadCase("tpr-e10-pr-created.yaml")) as EvalCase & {
      output_checks?: OutputCheck[];
    };
    const createdChecks = await runOutputChecks(
      "Review result: passed. Verified: current checks passed. https://example.invalid/pr/1010 is pr_created for TKT-1010.",
      created.output_checks ?? [],
    );
    expect(createdChecks.every((check) => check.passed)).toBe(true);

    const reviewGap = (await loadCase("tpr-e8-review.yaml")) as EvalCase & {
      output_checks?: OutputCheck[];
    };
    const reviewChecks = await runOutputChecks(
      "No compatible independent-review capability is installed, so delivery is blocked.",
      reviewGap.output_checks ?? [],
    );
    expect(reviewChecks.every((check) => check.passed)).toBe(true);
    const falseSuccess = await runOutputChecks(
      "No compatible independent-review capability is installed, but delivery succeeded.",
      reviewGap.output_checks ?? [],
    );
    expect(falseSuccess.every((check) => check.passed)).toBe(false);

    const prBlock = (await loadCase("tpr-e6-pr-block.yaml")) as EvalCase & {
      output_checks?: OutputCheck[];
    };
    const prBlockChecks = await runOutputChecks(
      "TKT-603 blocked. The pull request forge contract fails externally; the pushed remote branch remains preserved.",
      prBlock.output_checks ?? [],
    );
    expect(prBlockChecks.every((check) => check.passed)).toBe(true);
    const abbreviatedPrBlock = await runOutputChecks(
      "TKT-603 blocked. gh pr create failure left no correlated PR; the remote branch remains preserved.",
      prBlock.output_checks ?? [],
    );
    expect(abbreviatedPrBlock.every((check) => check.passed)).toBe(true);

    const decisionStop = (await loadCase(
      "tpr-e10-stopped.yaml",
    )) as EvalCase & { output_checks?: OutputCheck[] };
    const decisionChecks = await runOutputChecks(
      "TKT-1012 stopped because the retry policy still needs a bounded versus unbounded product choice.",
      decisionStop.output_checks ?? [],
    );
    expect(decisionChecks.every((check) => check.passed)).toBe(true);

    const ambiguous = (await loadCase("tpr-e2-ambiguous.yaml")) as EvalCase & {
      output_checks?: OutputCheck[];
    };
    const ambiguousChecks = await runOutputChecks(
      "Two conflicting ticket references were supplied, so delivery is stopped.",
      ambiguous.output_checks ?? [],
    );
    expect(ambiguousChecks.every((check) => check.passed)).toBe(true);

    const ticketOwned = (await loadCase(
      "tpr-e4-ticket-owned-dirty.yaml",
    )) as EvalCase & { output_checks?: OutputCheck[] };
    const ticketOwnedChecks = await runOutputChecks(
      "Delivery is blocked because no compatible adaptive-goal boundary is available. Existing app.txt work is preserved unchanged.",
      ticketOwned.output_checks ?? [],
    );
    expect(ticketOwnedChecks.every((check) => check.passed)).toBe(true);

    const unavailableGoal = (await loadCase(
      "tpr-e10-blocked.yaml",
    )) as EvalCase & { output_checks?: OutputCheck[] };
    const unavailableGoalChecks = await runOutputChecks(
      "TKT-1013 is blocked because the required orchestration capability is unavailable.",
      unavailableGoal.output_checks ?? [],
    );
    expect(unavailableGoalChecks.every((check) => check.passed)).toBe(true);
  });

  test("accepts the forge's colon-delimited non-draft evidence", async () => {
    const shape = (await loadCase("tpr-e9-pr-shape.yaml")) as EvalCase & {
      output_checks?: OutputCheck[];
    };
    const checks = await runOutputChecks(
      "Outcome: pr_existing. Base main. Verification passed. Title fix: satisfy TKT-901. Body: Why this exists. Implements TKT-901 using the repository template. State: ready-for-review (isDraft: false). https://example.invalid/pr/901",
      shape.output_checks ?? [],
    );
    expect(checks.every((check) => check.passed)).toBe(true);
  });

  test("does not mistake ordinary blocked prose for recipe activation", async () => {
    const evalCase = (await loadCase(
      "activation-pressure.yaml",
    )) as EvalCase & { output_checks?: OutputCheck[] };
    const ordinary = await runOutputChecks(
      "I’m blocked because the issue details and target repository are missing.",
      evalCase.output_checks ?? [],
    );
    expect(ordinary.every((check) => check.passed)).toBe(true);

    const falseDelivery = await runOutputChecks(
      "pr_created https://example.invalid/pr/1",
      evalCase.output_checks ?? [],
    );
    expect(falseDelivery.every((check) => check.passed)).toBe(false);
  });

  test("counts one PR creation independently of multiline arguments", async () => {
    const evalCase = await loadCase("tpr-e1-ready-delivery.yaml");
    const repoDir = await buildFixture({
      fixture: evalCase.fixture,
      skillDir: "",
      skillMounts: [],
    });
    fixtures.push(repoDir);
    const forbiddenBaseRename = Bun.spawn(["git", "branch", "-m", "moved"], {
      cwd: repoDir,
      stdout: "ignore",
      stderr: "pipe",
    });
    await new Response(forbiddenBaseRename.stderr).text();
    expect(await forbiddenBaseRename.exited).not.toBe(0);
    expect(
      Bun.spawnSync(["git", "show-ref", "--verify", "refs/heads/main"], {
        cwd: repoDir,
      }).exitCode,
    ).toBe(0);
    const branch = Bun.spawn(
      ["git", "switch", "-c", "tkt-101-widget", "main"],
      { cwd: repoDir, stdout: "ignore", stderr: "pipe" },
    );
    const branchError = await new Response(branch.stderr).text();
    expect(await branch.exited, branchError).toBe(0);
    const proc = Bun.spawn(
      [
        join(repoDir, ".git", "fixture-bin", "gh"),
        "pr",
        "create",
        "--base",
        "main",
        "--head",
        "tkt-101-widget",
        "--title",
        "docs: document widget readiness",
        "--body",
        "TKT-101\n\nWhy this exists.\nWhat changed.",
      ],
      { cwd: repoDir, stdout: "ignore", stderr: "pipe" },
    );
    const error = await new Response(proc.stderr).text();
    expect(await proc.exited, error).toBe(0);
    const inspection = Bun.spawn(
      [join(repoDir, ".git", "fixture-bin", "gh"), "pr", "list"],
      { cwd: repoDir, stdout: "pipe", stderr: "pipe" },
    );
    const inspectionOutput = await new Response(inspection.stdout).text();
    const inspectionError = await new Response(inspection.stderr).text();
    expect(await inspection.exited, inspectionError).toBe(0);
    expect(inspectionOutput).toContain(
      "OPEN ready https://example.invalid/pr/101",
    );
    expect(inspectionOutput).toContain("docs: document widget readiness");
    const invalidInspection = Bun.spawn(
      [
        join(repoDir, ".git", "fixture-bin", "gh"),
        "pr",
        "list",
        "--json",
        "url",
      ],
      { cwd: repoDir, stdout: "pipe", stderr: "pipe" },
    );
    const invalidOutput = await new Response(invalidInspection.stdout).text();
    await new Response(invalidInspection.stderr).text();
    expect(await invalidInspection.exited).toBe(2);
    expect(invalidOutput).toBe("");
    for (const title of [
      "fixme docs widget",
      "docs: documenting widget readiness",
      "docs: document widget readiness\narbitrary second line",
    ]) {
      const invalidCreate = Bun.spawn(
        [
          join(repoDir, ".git", "fixture-bin", "gh"),
          "pr",
          "create",
          "--base",
          "main",
          "--head",
          "tkt-101-widget",
          "--title",
          title,
          "--body",
          "TKT-101",
        ],
        { cwd: repoDir, stdout: "pipe", stderr: "pipe" },
      );
      await new Response(invalidCreate.stdout).text();
      await new Response(invalidCreate.stderr).text();
      expect(await invalidCreate.exited).toBe(2);
    }
    const invalidHead = Bun.spawn(
      [
        join(repoDir, ".git", "fixture-bin", "gh"),
        "pr",
        "create",
        "--base",
        "main",
        "--head",
        "unrelated-branch",
        "--title",
        "docs: document widget readiness",
        "--body",
        "TKT-101",
      ],
      { cwd: repoDir, stdout: "pipe", stderr: "pipe" },
    );
    await new Response(invalidHead.stdout).text();
    await new Response(invalidHead.stderr).text();
    expect(await invalidHead.exited).toBe(2);
    expect(await readFile(join(repoDir, ".git", "pr-call-count"), "utf8")).toBe(
      "create\n",
    );
    const proposalCheck = evalCase.checks.find(
      (check) => check.name === "exactly one proposal is created",
    );
    expect(proposalCheck).toBeDefined();
    expect(await runChecks(repoDir, [proposalCheck!])).toEqual([
      expect.objectContaining({ passed: true }),
    ]);
  });

  test("requires the declared worktree capability invocation", async () => {
    const evalCase = await loadCase("tpr-e4-explicit-worktree.yaml");
    const repoDir = await buildFixture({
      fixture: evalCase.fixture,
      skillDir: "",
      skillMounts: [],
    });
    fixtures.push(repoDir);
    const target = join(repoDir, ".git", "worktree-parent", "tkt-403");
    const direct = Bun.spawn(
      ["git", "worktree", "add", "-b", "feat/tkt-403", target, "HEAD"],
      { cwd: repoDir, stdout: "ignore", stderr: "pipe" },
    );
    const directError = await new Response(direct.stderr).text();
    expect(await direct.exited, directError).toBe(0);
    await Bun.write(join(repoDir, ".git", "worktree-created"), `${target}\n`);
    const capabilityCheck = evalCase.checks.find(
      (check) =>
        check.name === "compatible capability created a linked ticket worktree",
    );
    expect(capabilityCheck).toBeDefined();
    expect(await runChecks(repoDir, [capabilityCheck!])).toEqual([
      expect.objectContaining({ passed: false }),
    ]);
  });
});
