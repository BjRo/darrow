import { expect, test } from "bun:test";
import { transcriptPolicy } from "../sevro-extension/transcript-policy";

const route = { kind: "route", model: "gpt-6-luna", effort: "high" };

test("transcript declarations are independent of display names and field order", () => {
  const first = transcriptPolicy([{ name: "Selected route", ...route }])[0]!;
  const renamed = transcriptPolicy([
    {
      effort: "high",
      name: "Implementation route",
      model: "gpt-6-luna",
      kind: "route",
    },
  ])[0]!;
  expect(first).toEqual({
    id: "darrow.evals.transcript.1",
    name: "Selected route",
    ...route,
  });
  expect(renamed).toEqual({ ...first, name: "Implementation route" });
});

test.each([
  { name: "Unknown", kind: "unknown" },
  { name: "Route without effort", kind: "route", model: "gpt-6-luna" },
  { name: "Invalid effort", ...route, effort: "invented" },
  { name: "Undeclared parameter", ...route, ignored: true },
  { name: "Empty absence", kind: "inactive-controls" },
  { name: "Invalid absence", kind: "inactive-controls", forbidSpawn: false },
  { name: "Missing skill", kind: "supporting-skill-read" },
  {
    name: "Duplicate skill",
    kind: "skills-inactive",
    forbiddenSkills: ["adaptive-goal", "adaptive-goal"],
  },
])(
  "incomplete or unsupported transcript declarations fail resolution: $name",
  (check) => {
    expect(() => transcriptPolicy([check])).toThrow();
  },
);
