import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ActivationGate, ActivationExpectation } from "./activation";

type Cell = {
  caseId: string;
  harness: "codex" | "claude";
  mode: string;
  condition: "passive" | "enforced";
  activation: ActivationGate;
};
type DeclaredGate = Exclude<ActivationGate, { status: "not_requested" }>;

function declaredGates(cells: Cell[]): DeclaredGate[] {
  return cells.flatMap((cell) =>
    cell.activation.status === "not_requested" ? [] : [cell.activation],
  );
}

function classSummary(
  gates: DeclaredGate[],
  label: ActivationExpectation["class"],
) {
  const selected = gates.filter((gate) => gate.class === label);
  const trials = selected.reduce((sum, gate) => sum + gate.trials, 0);
  const measured = selected.reduce((sum, gate) => sum + gate.measured, 0);
  const passed = selected.reduce((sum, gate) => sum + gate.passed, 0);
  const failed = selected.reduce((sum, gate) => sum + gate.failed, 0);
  const unavailable = trials - measured;
  return {
    trials,
    measured,
    passed,
    failed,
    unavailable,
    passRate: trials > 0 && unavailable === 0 ? passed / trials : null,
  };
}

function selectionMetrics(gates: DeclaredGate[]) {
  if (
    gates.some(
      (gate) => gate.trueSelections === null || gate.falseSelections === null,
    )
  )
    return { recall: null, precision: null };
  const trueSelections = gates.reduce(
    (sum, gate) => sum + gate.trueSelections!,
    0,
  );
  const falseSelections = gates.reduce(
    (sum, gate) => sum + gate.falseSelections!,
    0,
  );
  const recallTrials = gates
    .filter((gate) => gate.class !== "negative")
    .reduce((sum, gate) => sum + gate.trials, 0);
  const denominator = trueSelections + falseSelections;
  return {
    recall: recallTrials ? trueSelections / recallTrials : null,
    precision: denominator ? trueSelections / denominator : null,
  };
}

function groupSummary(cells: Cell[]) {
  const gates = declaredGates(cells);
  return {
    harness: cells[0]!.harness,
    mode: cells[0]!.mode,
    condition: cells[0]!.condition,
    classes: {
      positive: classSummary(gates, "positive"),
      negative: classSummary(gates, "negative"),
      competition: classSummary(gates, "competition"),
    },
    ...selectionMetrics(gates),
  };
}

function reportData(cells: Cell[]) {
  const groups = new Map<string, Cell[]>();
  for (const cell of cells) {
    const key = `${cell.mode}/${cell.harness}`;
    const group = groups.get(key) ?? [];
    group.push(cell);
    groups.set(key, group);
  }
  const count = (status: ActivationGate["status"]) =>
    cells.filter((cell) => cell.activation.status === status).length;
  return {
    format: "darrow-sevro-activation-v1",
    rows: cells.map(({ caseId, harness, mode, condition, activation }) => ({
      caseId,
      harness,
      mode,
      condition,
      ...activation,
    })),
    groups: [...groups.values()].map(groupSummary),
    summary: {
      cells: cells.length,
      passed: count("passed"),
      failed: count("failed"),
      unavailable: count("unavailable"),
      notRun: count("not_run"),
      notRequested: count("not_requested"),
    },
  };
}

function percent(value: number | null) {
  return value === null ? "unknown" : `${(value * 100).toFixed(1)}%`;
}

function reportMarkdown(report: ReturnType<typeof reportData>) {
  const lines = ["# Darrow activation report", ""];
  for (const group of report.groups) {
    lines.push(
      `## ${group.mode} / ${group.harness} (${group.condition})`,
      "",
      `Recall: ${percent(group.recall)}; precision: ${percent(group.precision)}`,
      "",
      "| Class | Trials | Measured | Passed | Failed | Unavailable | Pass rate |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    );
    for (const [label, summary] of Object.entries(group.classes))
      lines.push(
        `| ${label} | ${summary.trials} | ${summary.measured} | ${summary.passed} | ${summary.failed} | ${summary.unavailable} | ${percent(summary.passRate)} |`,
      );
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function activationReports(resultsRoot: string, cells: Cell[]) {
  const report = reportData(cells);
  const jsonPath = join(resultsRoot, "activation-report.json");
  const markdownPath = join(resultsRoot, "activation-report.md");
  await Promise.all([
    writeFile(jsonPath, JSON.stringify(report, null, 2)),
    writeFile(markdownPath, reportMarkdown(report)),
  ]);
  return { jsonPath, markdownPath };
}
