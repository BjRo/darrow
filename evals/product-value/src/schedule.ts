import type {
  Assignment,
  Corpus,
  Harness,
  Phase,
  Protocol,
  Treatment,
} from "./types";

const ORDERS: Treatment[][] = [
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
  for (const task of corpus.tasks.filter((item) => item.phase === phase)) {
    for (const harness of Object.keys(protocol.harnesses) as Harness[]) {
      for (let repeat = 1; repeat <= protocol.repeats; repeat++) {
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
