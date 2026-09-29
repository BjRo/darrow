import { describe, expect, test } from "bun:test";
import { activationGate } from "../sevro-extension/activation";
import {
  activationReceipt,
  evaluateActivation,
  policyProject,
  preparePolicy,
  type ActivationOutcome,
} from "./policy-project";

const selectedTrials = (outcomes: ActivationOutcome[]) => ({
  execution: { status: "completed" },
  trials: outcomes.map((outcome, index) => ({
    trial: index + 1,
    execution: { status: "completed" },
    grading: { status: "completed" },
    domainOutcomes: [outcome],
  })),
});

describe("public skill activation policy", () => {
  test("supporting read membership accepts either order but not missing or incomplete evidence", async () => {
    const project = await policyProject({
      activation: "positive",
      activation_includes: ["verify-change", "code-review"],
      additional_plugins: ["plugins/capability/provider"],
    });
    const selected = await project.resolve();
    await preparePolicy(selected);
    for (const observedSkills of [
      ["grilling", "verify-change", "code-review"],
      ["grilling", "code-review", "verify-change"],
      ["grilling", "code-review"],
    ]) {
      for (const complete of [true, false]) {
        const grade = await evaluateActivation(selected, [
          activationReceipt(observedSkills, complete),
        ]);
        expect(grade.status).toBe(
          complete
            ? observedSkills.length === 3
              ? "passed"
              : "failed"
            : "unavailable",
        );
        expect(grade.data.requiredSkills).toEqual([
          "verify-change",
          "code-review",
        ]);
      }
    }
  });

  test("required activation membership must be declared and mounted", async () => {
    const project = await policyProject({ activation_includes: ["missing"] });
    await expect(project.resolve()).rejects.toThrow(
      /activation expectations require an activation class/,
    );
    await project.write({ activation: "positive", activation_includes: [] });
    await expect(project.resolve()).rejects.toThrow(
      /activation_includes must be a non-empty skill-name list/,
    );
    await project.write({ activation_includes: ["verify-change"] });
    await expect(preparePolicy(await project.resolve())).rejects.toThrow(
      /activation skill verify-change is absent from the mounted set/,
    );
    await project.write({
      additional_plugins: ["plugins/capability/provider"],
    });
    expect(await preparePolicy(await project.resolve())).toHaveProperty(
      "artifacts",
    );
  });

  test("validates exclusions from separately mounted composition plugins", async () => {
    const project = await policyProject({
      activation: "negative",
      activation_excludes: ["grilling", "verify-change"],
      additional_plugins: ["plugins/capability/provider"],
    });
    expect(await preparePolicy(await project.resolve())).toHaveProperty(
      "artifacts",
    );
    await project.write({ additional_plugins: undefined });
    await expect(preparePolicy(await project.resolve())).rejects.toThrow(
      /activation skill verify-change is absent from the mounted set/,
    );
    await project.write({
      additional_skills: ["plugins/capability/provider/skills/verify-change"],
    });
    expect(await preparePolicy(await project.resolve())).toHaveProperty(
      "artifacts",
    );
  });

  test("derives explicit and implicit probes from the shared placeholder", async () => {
    const project = await policyProject({
      prompt: "Use {{skill_invocation}} for this request.",
    });
    const explicit = await project.resolve();
    expect(explicit.prompt).toBe(
      "Use {{sevro.skill_invocation}} for this request.",
    );
    expect((await preparePolicy(explicit)).codexSkillInvocation).toEqual({
      pluginName: "sample",
      skillName: "grilling",
    });
    await project.write({ prompt: "Grill this plan." });
    const implicit = await project.resolve();
    expect(implicit.extensionData["darrow.case"].invocation).toBeUndefined();
    expect(
      (await preparePolicy(implicit)).codexSkillInvocation,
    ).toBeUndefined();
  });

  test("preserves owner requirements for adaptive-delivery and composition cases except negative activation", async () => {
    const owner = await policyProject(
      { goal_report: "forbidden", goal_route_checks: false },
      { plugin: "darrow-adaptive-delivery", skill: "adaptive-delivery" },
    );
    expect(
      (await owner.resolve()).checks.filter(
        (check) => check.grader === "darrow.evals.ownership",
      ),
    ).toHaveLength(3);
    const composition = await policyProject({
      adaptive_delivery_composition: true,
    });
    expect(
      (await composition.resolve()).checks.filter(
        (check) => check.grader === "darrow.evals.ownership",
      ),
    ).toHaveLength(2);
    await owner.write({
      activation: "negative",
      goal_report: undefined,
      goal_route_checks: undefined,
    });
    expect(
      (await owner.resolve()).checks.filter(
        (check) => check.grader === "darrow.evals.ownership",
      ),
    ).toEqual([]);
    expect(
      (await (await policyProject()).resolve()).checks.filter(
        (check) => check.grader === "darrow.evals.ownership",
      ),
    ).toEqual([]);
  });

  test("grades a positive primary selection and preserves unavailable evidence as unknown", async () => {
    const selected = await (
      await policyProject({ activation: "positive" })
    ).resolve();
    expect(
      await evaluateActivation(selected, [activationReceipt(["grilling"])]),
    ).toMatchObject({
      status: "passed",
      data: {
        class: "positive",
        targetSkill: "grilling",
        source: "sevro.host.codex",
        primarySkill: "grilling",
        observedSkills: ["grilling"],
      },
    });
    expect(await evaluateActivation(selected, [])).toMatchObject({
      status: "unavailable",
      data: {
        class: "positive",
        targetSkill: "grilling",
        source: null,
        primarySkill: null,
        observedSkills: [],
      },
    });
    expect(
      (await evaluateActivation(selected, [activationReceipt([], false)]))
        .status,
    ).toBe("unavailable");
  });

  test("grades negative avoidance and competition selection against the owning skill", async () => {
    const project = await policyProject({ activation: "negative" });
    const otherPrimary = activationReceipt(["discover-feature", "grilling"]);
    expect(
      (await evaluateActivation(await project.resolve(), [otherPrimary]))
        .status,
    ).toBe("passed");
    await project.write({
      activation: "competition",
      mount_plugin_skills: true,
    });
    const selected = await project.resolve();
    await preparePolicy(selected);
    expect((await evaluateActivation(selected, [otherPrimary])).status).toBe(
      "failed",
    );
  });

  test("requires a declared composed skill sequence after the primary owner", async () => {
    const project = await policyProject({
      activation: "competition",
      mount_plugin_skills: true,
      activation_sequence: ["grilling", "plan-implementation"],
    });
    const selected = await project.resolve();
    await preparePolicy(selected);
    expect(
      await evaluateActivation(selected, [
        activationReceipt(["grilling", "plan-implementation"]),
      ]),
    ).toMatchObject({
      status: "passed",
      data: { expectedSkills: ["grilling", "plan-implementation"] },
    });
    expect(
      (await evaluateActivation(selected, [activationReceipt(["grilling"])]))
        .status,
    ).toBe("failed");
    expect(
      (
        await evaluateActivation(selected, [
          activationReceipt(["plan-implementation", "grilling"]),
        ])
      ).status,
    ).toBe("failed");
  });

  test("can forbid a skill anywhere in an otherwise negative observation", async () => {
    const project = await policyProject({ activation: "negative" });
    const observation = activationReceipt(["discover-feature", "grilling"]);
    expect(
      (await evaluateActivation(await project.resolve(), [observation])).status,
    ).toBe("passed");
    await project.write({ activation_excludes: ["grilling"] });
    expect(
      await evaluateActivation(await project.resolve(), [observation]),
    ).toMatchObject({
      status: "failed",
      data: { excludedSkills: ["grilling"] },
    });
  });

  test("rejects unknown activation classes and competition without sibling skills", async () => {
    const project = await policyProject({ activation: "other" });
    await expect(project.resolve()).rejects.toThrow(
      /unsupported activation class/,
    );
    await project.write({ activation: "competition" });
    await expect(project.resolve()).rejects.toThrow(
      /competition activation requires sibling skill mounts/,
    );
    await project.write({ mount_plugin_skills: true });
    expect(
      (await project.resolve()).extensionData["darrow.case"].activation,
    ).toEqual({ class: "competition", targetSkill: "grilling" });
    await project.write({
      activation_sequence: ["plan-implementation", "grilling"],
    });
    await expect(project.resolve()).rejects.toThrow(
      /activation_sequence must start with a positive owning skill/,
    );
    await project.write({
      activation: "negative",
      activation_sequence: ["grilling"],
    });
    await expect(project.resolve()).rejects.toThrow(
      /activation_sequence must start with a positive owning skill/,
    );
    await project.write({
      activation_sequence: undefined,
      activation_excludes: [],
    });
    await expect(project.resolve()).rejects.toThrow(
      /activation_excludes must be a non-empty skill-name list/,
    );
  });

  test("does not average measured activation trials with an unknown trial", async () => {
    const selected = await (
      await policyProject({ activation: "positive" })
    ).resolve();
    const measured = await evaluateActivation(selected, [
      activationReceipt(["grilling"]),
    ]);
    const unknown = await evaluateActivation(selected, []);
    const expected = { class: "positive", targetSkill: "grilling" } as const;
    expect(
      activationGate(
        expected,
        { trials: 1, threshold: 0.8 },
        selectedTrials([measured]),
      ),
    ).toMatchObject({ status: "passed", passRate: 1 });
    expect(
      activationGate(
        expected,
        { trials: 2, threshold: 0.8 },
        selectedTrials([measured, unknown]),
      ),
    ).toMatchObject({
      status: "unavailable",
      passRate: null,
      measured: 1,
      unavailable: 1,
    });
  });

  test("gates declared activation independently while leaving undeclared cases alone", async () => {
    const selected = await (
      await policyProject({ activation: "positive" })
    ).resolve();
    const measured = await evaluateActivation(selected, [
      activationReceipt(["grilling"]),
    ]);
    const failed = await evaluateActivation(selected, [
      activationReceipt(["discover-feature"]),
    ]);
    const unknown = await evaluateActivation(selected, []);
    const expected = { class: "positive", targetSkill: "grilling" } as const;
    expect(
      activationGate(
        null,
        { trials: 1, threshold: 0.8 },
        selectedTrials([unknown]),
      ),
    ).toEqual({ status: "not_requested" });
    expect(
      activationGate(
        expected,
        { trials: 1, threshold: 0.8 },
        selectedTrials([unknown]),
      ),
    ).toMatchObject({ status: "unavailable", passRate: null });
    const trials = selectedTrials([measured, measured, failed]);
    expect(
      activationGate(expected, { trials: 3, threshold: 0.8 }, trials),
    ).toMatchObject({ status: "failed", passRate: 2 / 3 });
    expect(
      activationGate(expected, { trials: 3, threshold: 2 / 3 }, trials),
    ).toMatchObject({ status: "passed", passRate: 2 / 3 });
  });
});
