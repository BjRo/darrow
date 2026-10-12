import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveCase } from "../sevro-extension/index";
import { fixtureExtensionRequest } from "./fixture-command";
import { policyHostCapabilities } from "./policy-project";

type Call = { ordinal: number; namespace: string; name: string };
const projectRoot = pathToFileURL(resolve(import.meta.dir, "../..")).href;

for (const name of [
  "empty-diff",
  "invalid-base",
  "reviewer-route-unavailable",
]) {
  test(`Review terminal ${name} requires current bound native controls`, async () => {
    const { cases } = await resolveCase({
      projectRoot,
      selectors: { caseIds: [`code-review-${name}`] },
      configuration: {},
    });
    const selected = cases[0]!;
    expect(selected.requiredEvidence).toContain("sevro.host.native-controls");
    expect(JSON.stringify(selected)).not.toContain("retained-harness.jsonl");
    for (const host of ["codex", "claude"] as const) {
      await fixtureExtensionRequest("prepare", {
        case: selected,
        configuration: {},
        host: {
          id: `sevro.host.${host}`,
          capabilities: [
            ...policyHostCapabilities(host),
            "sevro.host.native-controls",
          ],
        },
      });
      const observation = (calls: Call[] = [], exec = 0) => ({
        id: "sevro.host.native-controls",
        source: `sevro.host.${host}`,
        completeness: "complete",
        data: {
          method: "native_control_calls",
          truncated: false,
          acceptedAgentCount: host === "codex" ? 0 : null,
          submittedExecCalls: host === "codex" ? exec : null,
          calls,
        },
      });
      const grade = async (observations: unknown[]) => {
        const result = await fixtureExtensionRequest<{
          checks: { id: string; status: string }[];
        }>("evaluate", {
          extensionData: selected.extensionData,
          observations,
          artifacts: [],
        });
        return result.checks.find(
          (check) => check.id === "darrow.evals.transcript.1",
        )?.status;
      };
      expect(await grade([observation()])).toBe("passed");
      expect(await grade([])).toBe("unavailable");
      expect(await grade([observation(), observation()])).toBe("unavailable");
      expect(await grade([{ ...observation(), completeness: "partial" }])).toBe(
        "unavailable",
      );
      expect(await grade([{ ...observation(), source: "another.host" }])).toBe(
        "unavailable",
      );
      const namespace = host === "codex" ? "collaboration" : "claude";
      const spawn = host === "codex" ? "spawn_agent" : "Agent";
      expect(
        await grade([observation([{ ordinal: 1, namespace, name: spawn }])]),
      ).toBe("failed");
      expect(
        await grade([
          observation([
            {
              ordinal: 1,
              namespace: host === "codex" ? "functions" : "claude",
              name: "update_goal",
            },
          ]),
        ]),
      ).toBe("passed");
      if (host === "codex")
        expect(await grade([observation([], 1)])).toBe("unavailable");
    }
  }, 30_000);
}
