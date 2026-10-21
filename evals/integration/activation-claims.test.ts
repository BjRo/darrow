import { expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { policyProject } from "../domain/policy-project";
import { captureTestCommand } from "../test-command";

test("installed Sevro accepts complete activation claims without accepting partial absence evidence", async () => {
  const project = await policyProject({
    activation: "competition",
    mount_plugin_skills: true,
  });
  const adapter = join(project.root, "claims-adapter.ts");
  await Bun.write(
    adapter,
    `export default {
    id: "sevro.host.codex", model: "synthetic", effort: "none",
    hostCapabilities: ["sevro.codex.plugin-marketplace", "sevro.host.skill-activation-claims"],
    async run() { return { complete: true, finalMessage: "ready", observations: [
      { id: "sevro.host.skill-activations", source: "sevro.host.codex", completeness: "partial", data: {
        method: "tool_result_body_match", visibility: "tool_result", scope: "prepared_skill_bodies",
        catalogComplete: true, observedSkills: ["sample:grilling"], partialSkills: [], ambiguousSkills: [],
        calls: [], truncated: false, incompleteReasons: ["pending_tool_calls"],
        primarySkill: "sample:grilling", primarySkillCompleteness: "complete"
      } },
      { id: "sevro.host.skill-activation-claims", source: "sevro.host.codex", completeness: "complete", data: {
        scope: "primary_and_positive_presence", collectionCompleteness: "partial",
        primarySkill: "sample:grilling", presentSkills: ["sample:grilling"]
      } }
    ] }; }
  };`,
  );
  const definitions = [
    {
      id: "claims-positive",
      activation: "competition",
      activation_excludes: undefined,
    },
    {
      id: "claims-negative",
      activation: "negative",
      activation_excludes: undefined,
    },
    {
      id: "claims-exclusion",
      activation: "competition",
      activation_excludes: ["plan-implementation"],
    },
  ];
  for (const definition of definitions) {
    await project.write(definition);
    const run = await captureTestCommand([
      process.execPath,
      resolve(import.meta.dir, "../sevro-extension/run.ts"),
      "--case-id",
      definition.id,
      "--project-root",
      project.root,
      "--results-root",
      join(project.root, definition.id),
      "--",
      "--adapter-module",
      adapter,
      "--condition",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
    ]);
    expect(run.exitCode, run.stderr).toBe(0);
    const result = JSON.parse(run.stdout);
    const trial = result.cases[0].trials[0];
    const activation = trial.domainOutcomes.find(
      (item: { id: string }) => item.id === "darrow.evals.activation",
    );
    expect(activation.status).toBe(
      definition.id === "claims-positive" ? "passed" : "unavailable",
    );
    const artifact = await Bun.file(trial.artifactPath).json();
    expect(
      artifact.evidence.observations.find(
        (item: { id: string }) => item.id === "sevro.host.skill-activations",
      ).completeness,
    ).toBe("partial");
    if (activation.status === "passed")
      expect(activation.evidenceRefs).toEqual([
        "sevro.host.skill-activation-claims",
      ]);
  }
});
