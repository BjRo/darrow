import type { OperatorAttentionInterval } from "./types";

export interface OperatorAttentionSession {
  measure(label: string, context: string): Promise<void>;
  intervals(): OperatorAttentionInterval[];
  totalMinutes(): number;
}

type Ask = (prompt: string) => Promise<string>;

export function formatOperatorGoal(goal: string): string {
  return [
    "==================== STEP GOAL ====================",
    goal.trim(),
    "===================================================",
  ].join("\n");
}

export function formatPatchReview(
  path: string | null,
  quickViewCommand?: string,
): string {
  return [
    "=============== PRIMARY REVIEW ARTIFACT ===============",
    "PATCH",
    path ?? "unavailable",
    ...(quickViewCommand
      ? ["", "Quick view (press q to return):", `  ${quickViewCommand}`]
      : []),
    "=======================================================",
  ].join("\n");
}

async function waitForCommand(
  expected: "ready" | "done",
  ask: Ask,
  write: (value: string) => void,
): Promise<void> {
  while (true) {
    const answer = (await ask(`Type ${expected} and press Enter: `))
      .trim()
      .toLowerCase();
    if (answer === expected) return;
    write(
      `\nNo action taken. Expected "${expected}"; the timer ${expected === "ready" ? "has not started" : "is still running"}.\n`,
    );
  }
}

export function createOperatorAttentionSession(
  ask: Ask,
  write: (value: string) => void,
  now: () => number = () => performance.now(),
): OperatorAttentionSession {
  const measured: OperatorAttentionInterval[] = [];

  return {
    async measure(label, context) {
      write(
        `\n[WAITING — timer off]\n${label} is ready. Return to this terminal when convenient.\n`,
      );
      await waitForCommand("ready", ask, write);
      const started = now();
      write(`\n[ACTIVE — timer running]\n${context}\n`);
      await waitForCommand("done", ask, write);
      const durationMs = Math.max(0, now() - started);
      measured.push({ label, durationMs });
      write(
        `\n[WAITING — timer off]\nRecorded ${(durationMs / 1_000).toFixed(1)}s of active attention. Continuing in the background.\n`,
      );
    },
    intervals() {
      return measured.map((interval) => ({ ...interval }));
    },
    totalMinutes() {
      return (
        measured.reduce((sum, interval) => sum + interval.durationMs, 0) /
        60_000
      );
    },
  };
}
