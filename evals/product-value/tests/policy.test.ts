import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  isCliPlaybookTreatment,
  isOperationalDiagnosticTreatment,
  manualPlaybookImplementationPrompt,
  manualPlaybookReviewPrompt,
  sharedTddPrompt,
  SHARED_TDD_POLICY,
  usesSharedTddPolicy,
} from "../src/policy";

describe("shared delivery policy", () => {
  test("adds the minimal Red/Green policy to direct core treatments", () => {
    const prompt = sharedTddPrompt("return the supplied instant");
    expect(prompt).toContain("Requested change: return the supplied instant");
    expect(prompt).toContain(SHARED_TDD_POLICY);
    expect(prompt.match(/Use Red\/Green TDD/g)).toHaveLength(1);
    expect(prompt).toContain("relevant regression tests");
    expect(prompt).not.toContain("evidence");
    expect(prompt).not.toContain("output schema");
  });

  test("uses the same policy wording in the CLI implementation skill", async () => {
    const skill = await Bun.file(
      resolve(
        import.meta.dir,
        "../../..",
        "plugins/darrow-delivery/skills/implement/SKILL.md",
      ),
    ).text();
    expect(skill.replace(/\s+/g, " ")).toContain(SHARED_TDD_POLICY);
  });

  test("makes fresh verification the explicit CLI orchestration difference", async () => {
    const workflow = parseYaml(
      await Bun.file(
        resolve(
          import.meta.dir,
          "../../..",
          "cli/workflows/implement-change.yaml",
        ),
      ).text(),
    ) as {
      profile: string;
      steps: Array<{
        id: string;
        dependsOn: string[];
        command: { id: string };
      }>;
    };
    expect(workflow.profile).toBe("codex");
    expect(workflow.steps).toEqual([
      expect.objectContaining({
        id: "implement",
        dependsOn: [],
        command: { id: "darrow-delivery:implement", version: "^0.1.0" },
      }),
      expect.objectContaining({
        id: "verify-and-repair",
        dependsOn: ["implement"],
        command: {
          id: "darrow-delivery:verify-and-repair",
          version: "^0.2.0",
        },
      }),
    ]);
  });

  test("injects the policy only into direct core prompts", () => {
    expect(usesSharedTddPolicy("native")).toBe(true);
    expect(usesSharedTddPolicy("plugins")).toBe(true);
    expect(usesSharedTddPolicy("cli")).toBe(false);
    expect(usesSharedTddPolicy("native-no-tdd")).toBe(false);
    expect(usesSharedTddPolicy("plugins-no-tdd")).toBe(false);
  });

  test("makes the manual diagnostic invoke the same two command skills", () => {
    expect(
      manualPlaybookImplementationPrompt("change", "/skill/implement"),
    ).toContain("darrow-delivery:implement");
    expect(manualPlaybookReviewPrompt("change", "/skill/review")).toContain(
      "darrow-delivery:verify-and-repair",
    );
    expect(isCliPlaybookTreatment("cli")).toBe(true);
    expect(isCliPlaybookTreatment("cli-playbook")).toBe(true);
    expect(isCliPlaybookTreatment("manual-playbook")).toBe(false);
    expect(isOperationalDiagnosticTreatment("manual-playbook")).toBe(true);
    expect(isOperationalDiagnosticTreatment("cli-playbook")).toBe(true);
    expect(isOperationalDiagnosticTreatment("plugins")).toBe(false);
  });
});
