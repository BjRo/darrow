import type {
  Assignment,
  CoreTreatment,
  Corpus,
  Harness,
  Phase,
  Protocol,
} from "./types";

const ORDERS: CoreTreatment[][] = [
  ["native", "plugins", "cli"],
  ["native", "cli", "plugins"],
  ["plugins", "native", "cli"],
  ["plugins", "cli", "native"],
  ["cli", "native", "plugins"],
  ["cli", "plugins", "native"],
];

function hash(value: string): number {
  const bytes = new TextEncoder().encode(value);
  let result = 2166136261;
  for (const byte of bytes) {
    result ^= byte;
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function buildSchedule(
  protocol: Protocol,
  corpus: Corpus,
  phase: Phase,
): Assignment[] {
  const blocks: Array<{ key: number; assignments: Assignment[] }> = [];
  const phaseSettings = protocol.phases[phase];
  const tasks =
    phase === "smoke"
      ? corpus.tasks.filter((item) => item.id === phaseSettings.taskId)
      : corpus.tasks.filter((item) => item.phase === phase);
  if (phase === "smoke" && tasks.length !== 1)
    throw new Error(`smoke task is unavailable: ${phaseSettings.taskId}`);
  for (const task of tasks) {
    for (const harness of Object.keys(protocol.harnesses) as Harness[]) {
      for (let repeat = 1; repeat <= phaseSettings.repeats; repeat++) {
        const start =
          hash(`${protocol.frozenSeed}:${task.id}:${harness}:${repeat}`) %
          ORDERS.length;
        const order = ORDERS[(start + repeat - 1) % ORDERS.length]!;
        blocks.push({
          key: hash(
            `${protocol.frozenSeed}:block:${repeat}:${task.id}:${harness}`,
          ),
          assignments: order.map((treatment, index) => ({
            ordinal: 0,
            taskId: task.id,
            repository: task.repository,
            phase,
            stratum: task.stratum,
            harness,
            treatment,
            repeat,
            order: index + 1,
          })),
        });
      }
    }
  }
  blocks.sort(
    (a, b) =>
      a.assignments[0]!.repeat - b.assignments[0]!.repeat || a.key - b.key,
  );
  const assignments = blocks.flatMap((block) => block.assignments);
  return assignments.map((assignment, index) => ({
    ...assignment,
    ordinal: index + 1,
  }));
}

export function buildPolicyDiagnosticSchedule(
  protocol: Protocol,
  corpus: Corpus,
): Assignment[] {
  const taskId = protocol.phases.smoke.taskId;
  const task = corpus.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`smoke task is unavailable: ${taskId}`);
  const treatments = [
    "native-matched-policy",
    "plugins-matched-policy",
  ] as const;
  const start =
    hash(`${protocol.frozenSeed}:${task.id}:codex:matched-policy`) % 2;
  const auxiliary = treatments
    .slice(start)
    .concat(treatments.slice(0, start))
    .map((treatment, index) => ({
      ordinal: index + 1,
      taskId: task.id,
      repository: task.repository,
      phase: "smoke" as const,
      stratum: task.stratum,
      harness: "codex" as const,
      treatment,
      repeat: 1,
      order: index + 1,
    }));
  const baselines = buildSchedule(protocol, corpus, "smoke").filter(
    (assignment) =>
      assignment.harness === "codex" &&
      (assignment.treatment === "native" || assignment.treatment === "plugins"),
  );
  return [...baselines, ...auxiliary].sort(
    (left, right) =>
      hash(`${protocol.frozenSeed}:policy-order:${left.treatment}`) -
      hash(`${protocol.frozenSeed}:policy-order:${right.treatment}`),
  );
}
