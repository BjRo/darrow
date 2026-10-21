import { fixtureExtensionRequest } from "./fixture-command";
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

function commonActivation(skills: string[]) {
  return {
    id: "sevro.host.skill-activations",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "tool_result_body_match",
      visibility: "tool_result",
      scope: "prepared_skill_bodies",
      catalogComplete: true,
      observedSkills: skills,
      partialSkills: [],
      ambiguousSkills: [],
      calls: [],
      truncated: false,
    },
  };
}

function primaryClaims(skills = ["sample:grilling"]) {
  const primarySkill = skills[0] ?? null;
  return [
    {
      ...commonActivation(skills),
      completeness: "partial",
      data: {
        ...commonActivation(skills).data,
        primarySkill,
        primarySkillCompleteness: "complete",
        incompleteReasons: ["pending_tool_calls"],
      },
    },
    {
      id: "sevro.host.skill-activation-claims",
      source: "sevro.host.codex",
      completeness: "complete",
      data: {
        scope: "primary_and_positive_presence",
        collectionCompleteness: "partial",
        primarySkill,
        presentSkills: skills,
      },
    },
  ];
}

test("rc20 primary claims cite complete evidence without upgrading partial collection", async () => {
  const selected = await (
    await policyProject({
      activation: "competition",
      mount_plugin_skills: true,
    })
  ).resolve();
  const observations = primaryClaims();
  expect(await evaluateActivation(selected, observations)).toMatchObject({
    status: "passed",
    evidenceRefs: ["sevro.host.skill-activation-claims"],
    data: {
      primarySkill: "grilling",
      observedSkills: ["grilling"],
      evidenceScope: "primary_and_positive_presence",
      collectionCompleteness: "partial",
    },
  });
  expect(observations[0]!.completeness).toBe("partial");
  expect(
    (
      await evaluateActivation(
        selected,
        primaryClaims(["sample:discover-feature"]),
      )
    ).status,
  ).toBe("failed");
});

test("rc20 claims prove positive membership but never missing membership, exclusions or sequences", async () => {
  const project = await policyProject({
    activation: "positive",
    additional_plugins: ["plugins/capability/provider"],
    activation_includes: ["code-review"],
  });
  expect(
    (
      await evaluateActivation(
        await project.resolve(),
        primaryClaims(["sample:grilling", "provider:code-review"]),
      )
    ).status,
  ).toBe("passed");
  expect(
    (await evaluateActivation(await project.resolve(), primaryClaims())).status,
  ).toBe("unavailable");
  for (const definition of [
    { activation: "negative" },
    { activation: "positive", activation_excludes: ["grilling"] },
    {
      activation: "positive",
      activation_sequence: ["grilling", "plan-implementation"],
      mount_plugin_skills: true,
    },
  ]) {
    const selected = await (await policyProject(definition)).resolve();
    expect(
      (
        await evaluateActivation(
          selected,
          primaryClaims(["sample:grilling", "sample:plan-implementation"]),
        )
      ).status,
    ).toBe("unavailable");
  }
});

test("rc20 claims fail closed for missing, duplicate, foreign and contradictory evidence", async () => {
  const selected = await (
    await policyProject({ activation: "positive" })
  ).resolve();
  const [collection, claim] = primaryClaims();
  for (const observations of [
    [collection],
    [claim],
    [collection, claim, claim],
    [collection, collection, claim],
    [collection, { ...claim, source: "sevro.host.claude" }],
    [collection, { ...claim, completeness: "partial" }],
    [
      collection,
      { ...claim, data: { ...claim!.data, scope: "whole_collection" } },
    ],
    [
      collection,
      {
        ...claim,
        data: { ...claim!.data, primarySkill: "sample:discover-feature" },
      },
    ],
    [
      collection,
      {
        ...claim,
        data: {
          ...claim!.data,
          presentSkills: ["sample:grilling", "foreign:code-review"],
        },
      },
    ],
    [
      collection,
      {
        ...claim,
        data: {
          ...claim!.data,
          presentSkills: ["sample:grilling", "grilling"],
        },
      },
    ],
    [
      {
        ...collection,
        data: { ...collection!.data, primarySkillCompleteness: "partial" },
      },
      claim,
    ],
    [{ ...collection, completeness: "complete" }, claim],
  ])
    expect((await evaluateActivation(selected, observations)).status).toBe(
      "unavailable",
    );
});

test("rc20 claims reject collection gaps that cannot establish a primary", async () => {
  const selected = await (
    await policyProject({ activation: "positive" })
  ).resolve();
  const [collection, claim] = primaryClaims();
  for (const incompleteReasons of [
    ["host_incomplete"],
    ["observer_failure"],
    undefined,
    null,
    "pending_tool_calls",
    [],
    [17],
    ["pending_tool_calls", "host_incomplete"],
    ["pending_tool_calls", "pending_tool_calls"],
  ]) {
    const outcome = await evaluateActivation(selected, [
      {
        ...collection,
        data: { ...collection!.data, incompleteReasons },
      },
      claim,
    ]);
    expect(outcome.status, JSON.stringify(incompleteReasons) ?? "missing").toBe(
      "unavailable",
    );
  }
});

test("rc20 complete collection does not invent a primary from catalog order", async () => {
  const selected = await (
    await policyProject({ activation: "positive" })
  ).resolve();
  const receipt = commonActivation([
    "sample:grilling",
    "sample:plan-implementation",
  ]);
  for (const data of [
    { primarySkill: null, primarySkillCompleteness: "partial" },
    {
      primarySkill: "sample:plan-implementation",
      primarySkillCompleteness: "complete",
    },
  ])
    expect(
      (
        await evaluateActivation(selected, [
          { ...receipt, data: { ...receipt.data, ...data } },
        ])
      ).status,
    ).toBe("unavailable");
  expect(
    (
      await evaluateActivation(selected, [
        {
          ...receipt,
          data: {
            ...receipt.data,
            primarySkill: "sample:grilling",
            primarySkillCompleteness: "complete",
          },
        },
      ])
    ).status,
  ).toBe("passed");
});

test("rc15 common activation preserves qualified identity and fails closed without healthy collection", async () => {
  const selected = await (
    await policyProject({ activation: "positive" })
  ).resolve();
  const receipt = commonActivation(["sample:grilling"]);
  expect(await evaluateActivation(selected, [receipt])).toMatchObject({
    status: "passed",
    data: { primarySkill: "grilling", observedSkills: ["grilling"] },
  });
  expect(
    (await evaluateActivation(selected, [commonActivation([])])).status,
  ).toBe("failed");
  for (const observations of [
    [receipt, receipt],
    [{ ...receipt, completeness: "partial" }],
    [{ ...receipt, source: "foreign" }],
    [commonActivation(["foreign:grilling"])],
    [commonActivation(["sample:grilling", "grilling"])],
    ...[
      { truncated: true },
      { catalogComplete: false },
      { partialSkills: ["sample:grilling"] },
      { ambiguousSkills: ["sample:grilling"] },
      { method: "unverified" },
      { calls: null },
      { observedSkills: [12] },
    ].map((data) => [{ ...receipt, data: { ...receipt.data, ...data } }]),
  ])
    expect((await evaluateActivation(selected, observations)).status).toBe(
      "unavailable",
    );
  const partial = { ...receipt, completeness: "partial" };
  expect(
    (
      await evaluateActivation(selected, [
        partial,
        activationReceipt(["grilling"]),
      ])
    ).status,
  ).toBe("unavailable");
  const negative = await (
    await policyProject({ activation: "negative" })
  ).resolve();
  expect(
    (await evaluateActivation(negative, [commonActivation([])])).status,
  ).toBe("passed");
  expect(
    (
      await evaluateActivation(negative, [
        { ...commonActivation([]), completeness: "partial" },
      ])
    ).status,
  ).toBe("unavailable");
});

test("rc15 Claude activation uses successful Skill collection and retains repository namespace boundaries", async () => {
  const project = await policyProject({ activation: "positive" });
  const receipt = {
    id: "sevro.host.skill-activations",
    source: "sevro.host.claude",
    completeness: "complete",
    data: {
      method: "skill_tool_result",
      visibility: "skill_tool",
      observedSkills: ["sample:grilling"],
      calls: [],
      truncated: false,
    },
  };
  expect(
    (await evaluateActivation(await project.resolve(), [receipt])).status,
  ).toBe("passed");
  const repository = await (
    await policyProject({ activation: "positive" }, { repository: true })
  ).resolve();
  expect((await evaluateActivation(repository, [receipt])).status).toBe(
    "unavailable",
  );
  expect(
    (
      await evaluateActivation(repository, [
        { ...receipt, data: { ...receipt.data, observedSkills: ["grilling"] } },
      ])
    ).status,
  ).toBe("passed");
});

test("rc15 explicit dispatch remains separate from complete supporting activations", async () => {
  const selected = await (
    await policyProject({
      activation: "positive",
      prompt: "Use {{skill_invocation}}.",
      additional_plugins: ["plugins/capability/provider"],
      activation_includes: ["code-review"],
    })
  ).resolve();
  const dispatch = {
    id: "sevro.codex.explicit-invocation",
    source: "sevro.host.codex",
    completeness: "complete",
    data: { method: "explicit_invocation", primarySkill: "grilling" },
  };
  const receipt = commonActivation(["provider:code-review"]);
  expect(await evaluateActivation(selected, [dispatch, receipt])).toMatchObject(
    { status: "passed" },
  );
  expect(
    await evaluateActivation(selected, [
      { ...dispatch, data: { ...dispatch.data, primarySkill: "wrong-owner" } },
      receipt,
    ]),
  ).toMatchObject({
    status: "failed",
    data: {
      primarySkill: "wrong-owner",
      observedSkills: ["wrong-owner", "code-review"],
    },
  });
  expect((await evaluateActivation(selected, [dispatch])).status).toBe(
    "unavailable",
  );
  expect((await evaluateActivation(selected, [receipt])).status).toBe(
    "unavailable",
  );
  expect(
    (
      await evaluateActivation(selected, [
        dispatch,
        { ...receipt, completeness: "partial" },
      ])
    ).status,
  ).toBe("unavailable");
  expect(
    (await evaluateActivation(selected, [dispatch, commonActivation([])]))
      .status,
  ).toBe("failed");
});

test("rc15 Claude explicit supporting assertions require a bound dispatch and complete common collection", async () => {
  const project = await policyProject(
    {
      activation: "positive",
      prompt: "{{skill_invocation}} Help.",
      additional_plugins: ["plugins/capability/provider"],
      activation_includes: ["code-review"],
    },
    { repository: true },
  );
  const selected = await project.resolve();
  const dispatch = {
    id: "sevro.claude.repository-invocation",
    source: "sevro.host.claude",
    completeness: "complete",
    data: {
      method: "native_repository_command",
      accepted: true,
      skill: "grilling",
      reason: "native command and complete mounted body matched",
    },
  };
  const collection = {
    id: "sevro.host.skill-activations",
    source: "sevro.host.claude",
    completeness: "complete",
    data: {
      method: "skill_tool_result",
      visibility: "skill_tool",
      observedSkills: ["provider:code-review"],
      calls: [],
      truncated: false,
    },
  };
  expect(
    (await evaluateActivation(selected, [dispatch, collection])).status,
  ).toBe("passed");
  for (const observations of [
    [dispatch],
    [collection],
    [dispatch, { ...collection, completeness: "partial" }],
    [{ ...dispatch, completeness: "partial" }, collection],
    [{ ...dispatch, data: { ...dispatch.data, accepted: false } }, collection],
    [
      { ...dispatch, data: { ...dispatch.data, skill: "wrong-owner" } },
      collection,
    ],
  ])
    expect((await evaluateActivation(selected, observations)).status).toBe(
      "unavailable",
    );
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

  test("preserves owner requirements for adaptive-goal and composition cases except negative activation", async () => {
    const owner = await policyProject(
      { goal_report: "forbidden", goal_route_checks: false },
      { plugin: "darrow-adaptive-goal", skill: "adaptive-goal" },
    );
    expect(
      (await owner.resolve()).checks.filter(
        (check) => check.grader === "darrow.evals.ownership",
      ),
    ).toHaveLength(3);
    const composition = await policyProject({
      adaptive_goal_composition: true,
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

  test("retains definitive activation when only unrelated task grading is unavailable", async () => {
    const selected = await (
      await policyProject({ activation: "positive" })
    ).resolve();
    const passed = await evaluateActivation(selected, [
      activationReceipt(["grilling"]),
    ]);
    const failed = await evaluateActivation(selected, [
      activationReceipt(["discover-feature"]),
    ]);
    const unknown = await evaluateActivation(selected, []);
    const expected = { class: "positive", targetSkill: "grilling" } as const;
    const gate = (
      outcome: ActivationOutcome,
      grading: string,
      execution = "completed",
    ) => {
      const result = selectedTrials([outcome]);
      result.trials[0]!.grading.status = grading;
      result.trials[0]!.execution.status = execution;
      const measurement = activationGate(
        expected,
        { trials: 1, threshold: 1 },
        result,
      );
      expect(result.trials[0]!.grading.status).toBe(grading);
      return measurement;
    };
    expect(gate(passed, "unavailable")).toMatchObject({
      status: "passed",
      measured: 1,
      passRate: 1,
    });
    expect(gate(failed, "unavailable")).toMatchObject({
      status: "failed",
      measured: 1,
      passRate: 0,
    });
    expect(gate(unknown, "unavailable")).toMatchObject({
      status: "unavailable",
      measured: 0,
      passRate: null,
    });
    for (const grading of ["error", "not_requested", "unknown"]) {
      expect(gate(passed, grading)).toMatchObject({
        status: "unavailable",
        measured: 0,
      });
    }
    expect(gate(passed, "unavailable", "failed")).toMatchObject({
      status: "unavailable",
      measured: 0,
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

test("Explicit owner dispatch does not establish complete supporting reads", async () => {
  const dispatch = {
    id: "sevro.codex.explicit-invocation",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "explicit_invocation",
      primarySkill: "verify-change",
      observedSkills: ["verify-change", "code-review"],
    },
  };
  const reads = commonActivation(["code-review"]);
  const grade = async (
    observations: unknown[],
    expectation: Record<string, unknown>,
  ) => {
    const result = await fixtureExtensionRequest<{
      domainOutcomes: { status: string; evidenceRefs: string[] }[];
    }>("evaluate", {
      extensionData: {
        "darrow.case": {
          activation: {
            class: "positive",
            targetSkill: "verify-change",
            ...expectation,
          },
          invocation: { pluginName: "probe", skillName: "verify-change" },
        },
      },
      observations,
    });
    return result.domainOutcomes[0]!;
  };
  expect(
    (await grade([dispatch, { ...reads, completeness: "partial" }], {})).status,
  ).toBe("passed");
  for (const expectation of [
    { includes: ["code-review"] },
    { sequence: ["verify-change", "code-review"] },
    { excludes: ["adaptive-goal"] },
  ]) {
    expect(await grade([dispatch, reads], expectation)).toMatchObject({
      status: "passed",
      evidenceRefs: [dispatch.id, reads.id],
    });
    for (const observations of [
      [dispatch],
      [dispatch, { ...reads, completeness: "partial" }],
      [dispatch, reads, reads],
      [dispatch, { ...reads, source: "other" }],
    ]) {
      expect((await grade(observations, expectation)).status).toBe(
        "unavailable",
      );
    }
  }
  const ownerOnly = {
    ...dispatch,
    data: { ...dispatch.data, observedSkills: ["verify-change"] },
  };
  const noSupport = {
    ...reads,
    data: { ...reads.data, primarySkill: null, observedSkills: [] },
  };
  expect(
    (await grade([ownerOnly, noSupport], { includes: ["code-review"] })).status,
  ).toBe("failed");
}, 30_000);
