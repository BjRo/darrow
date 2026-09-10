import { expect, test } from "bun:test";
import { parse } from "yaml";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/verification-cadence.yaml",
  import.meta.url,
);

for (const scenario of [
  {
    name: "red green final",
    events: ["focused fail", "focused pass", "final pass"],
    passes: true,
  },
  {
    name: "repeated final confirmation",
    events: ["focused fail", "focused pass", "final pass", "final pass"],
    passes: true,
  },
  {
    name: "repaired final check",
    events: [
      "focused fail",
      "focused pass",
      "final fail",
      "focused pass",
      "final pass",
    ],
    passes: true,
  },
  {
    name: "missing red",
    events: ["focused pass", "final pass"],
    passes: false,
  },
  {
    name: "missing green",
    events: ["focused fail", "final pass"],
    passes: false,
  },
  {
    name: "baseline gate followed by final verification",
    events: ["final pass", "focused fail", "focused pass", "final pass"],
    passes: true,
  },
  {
    name: "baseline gate does not replace final verification",
    events: ["final pass", "focused fail", "focused pass"],
    passes: false,
  },
  {
    name: "last final failed",
    events: ["focused fail", "focused pass", "final pass", "final fail"],
    passes: false,
  },
  {
    name: "later focused failure",
    events: ["focused fail", "focused pass", "final pass", "focused fail"],
    passes: false,
  },
  {
    name: "redundant focused confirmation",
    events: ["focused fail", "focused pass", "final pass", "focused pass"],
    passes: true,
  },
  { name: "no evidence", events: [], passes: false },
]) {
  test(`verification cadence: ${scenario.name}`, async () => {
    const evalCase = parse(await Bun.file(source).text()) as EvalCase;
    const check = evalCase.checks.find(
      (c) => c.name === "feedback precedes final-tree verification",
    )!;
    const repo = await buildFixture({
      fixture: {
        commits: [
          {
            message: "Cadence fixture",
            files: { "README.md": "Synthetic trace\n" },
          },
        ],
        files: {
          ".git/fixture-state/verification-trace":
            scenario.events
              .map((event) => event.replace(" ", "\t"))
              .join("\n") + "\n",
        },
      },
      skillDir: "",
      skillMounts: [],
    });
    try {
      const result = Bun.spawnSync(["/bin/bash", "-c", check.run], {
        cwd: repo,
      });
      expect(result.exitCode === 0).toBe(scenario.passes);
    } finally {
      await destroyFixture(repo);
    }
  });
}
