import { expect, test } from "bun:test";
import {
  assessmentReadersSelection,
  codexAssessmentReaders as assessCodex,
  type AssessmentReaders,
} from "../sevro-extension/assessment-readers";

const codexAssessmentReaders = (
  expected: AssessmentReaders,
  ...[spawns, children, nested, complete]: [
    Record<string, unknown>[] | null,
    Record<string, unknown>[] | null,
    Record<string, unknown>[] | null,
    boolean,
  ]
) => assessCodex(expected, { spawns, children, nested, complete });

const expected: AssessmentReaders = {
  placement: "inline",
  axes: ["standards", "spec"],
  model: "gpt-6.1-sol",
  effort: "xhigh",
};
const spawns = ["standards", "spec"].map((axis) => ({
  taskName: "review_" + axis,
  threadId: axis,
  agentRef: "/root/" + axis,
  model: "gpt-6.1-sol",
  reasoningEffort: "xhigh",
  forkTurns: "none",
}));
const children = spawns.map((spawn) => ({
  threadId: spawn.threadId,
  status: "available",
  resultStatus: "completed",
}));
const nested = spawns.map((spawn) => ({
  ...spawn,
  status: "accepted",
  sessionStatus: "available",
  readerResultStatus: "completed",
}));
const coordinator = [
  {
    taskName: "assessment",
    threadId: "coordinator",
    model: "gpt-6.1-sol",
    reasoningEffort: "medium",
    forkTurns: "none",
  },
];

test("v2 inline proof requires completed fresh readers on the selected routes", () => {
  expect(codexAssessmentReaders(expected, spawns, children, [], true)).toBe(
    "passed",
  );
  expect(codexAssessmentReaders(expected, spawns, children, [], false)).toBe(
    "unavailable",
  );
  expect(
    codexAssessmentReaders(expected, spawns, children.slice(0, 1), [], true),
  ).toBe("unavailable");
  expect(
    codexAssessmentReaders(expected, spawns.slice(0, 1), children, [], true),
  ).toBe("failed");
  expect(
    codexAssessmentReaders(
      expected,
      [...spawns, spawns[0]!],
      children,
      [],
      true,
    ),
  ).toBe("failed");
  expect(
    codexAssessmentReaders(expected, coordinator, children, nested, true),
  ).toBe("failed");
  for (const [field, value, status] of [
    ["forkTurns", "all", "failed"],
    ["forkTurns", undefined, "unavailable"],
    ["model", "gpt-6-luna", "failed"],
    ["reasoningEffort", "medium", "failed"],
    ["model", undefined, "unavailable"],
    ["taskName", "unbound_reader", "failed"],
  ] as const) {
    expect(
      codexAssessmentReaders(
        expected,
        [{ ...spawns[0], [field]: value }, spawns[1]!],
        children,
        [],
        true,
      ),
    ).toBe(status);
  }
});

test("v2 fallback proof retains the one capable coordinator and its readers", () => {
  const fallback: AssessmentReaders = { ...expected, placement: "fallback" };
  const owner = [
    { threadId: "coordinator", status: "available", resultStatus: "completed" },
  ];
  expect(
    codexAssessmentReaders(fallback, coordinator, owner, nested, true),
  ).toBe("passed");
  expect(codexAssessmentReaders(fallback, coordinator, owner, null, true)).toBe(
    "unavailable",
  );
  expect(codexAssessmentReaders(fallback, coordinator, owner, [], true)).toBe(
    "failed",
  );
  expect(
    codexAssessmentReaders(
      fallback,
      [{ ...coordinator[0], model: "gpt-6-luna" }],
      owner,
      nested,
      true,
    ),
  ).toBe("failed");
  expect(
    codexAssessmentReaders(
      fallback,
      coordinator,
      owner,
      [{ ...nested[0], status: "unaccepted" }, nested[1]!],
      true,
    ),
  ).toBe("unavailable");
  expect(
    codexAssessmentReaders(
      fallback,
      coordinator,
      owner,
      [{ ...nested[0], taskName: "another_coordinator" }, nested[1]!],
      true,
    ),
  ).toBe("failed");
  expect(
    codexAssessmentReaders(
      fallback,
      coordinator,
      owner,
      [{ ...nested[0], readerResultStatus: "unavailable" }, nested[1]!],
      true,
    ),
  ).toBe("unavailable");
});

test("placement declarations reject ambiguous or weakened proof requests", () => {
  expect(assessmentReadersSelection(expected)).toEqual(expected);
  for (const value of [
    null,
    [],
    {},
    { ...expected, axes: [] },
    { ...expected, axes: ["spec", "spec"] },
    { ...expected, placement: "either" },
    { ...expected, route: "inherited" },
    { ...expected, effort: "" },
  ]) {
    expect(() => assessmentReadersSelection(value)).toThrow();
  }
});
