import type { Treatment } from "./types";

export const SHARED_TDD_POLICY =
  "Use Red/Green TDD to implement the requested change. Use an existing focused behavioral test when it covers the requested behavior; otherwise add or adjust one. Run that test before changing production code and confirm it fails because the requested behavior is missing. Then make the smallest change that passes the same test and run the relevant regression tests. If the normal test command fails for an unrelated setup reason, run the focused test directly or through another available command; an unrelated failure is not red.";

export function usesSharedTddPolicy(treatment: Treatment): boolean {
  return treatment === "native" || treatment === "plugins";
}

export function sharedTddPrompt(change: string): string {
  return [`Requested change: ${change}`, SHARED_TDD_POLICY].join("\n\n");
}

export function isCliPlaybookTreatment(treatment: Treatment): boolean {
  return treatment === "cli" || treatment === "cli-playbook";
}

export function isOperationalDiagnosticTreatment(
  treatment: Treatment,
): boolean {
  return treatment === "manual-playbook" || treatment === "cli-playbook";
}

export function manualPlaybookImplementationPrompt(
  change: string,
  skillPath: string,
): string {
  return [
    "Invoke the command darrow-delivery:implement@0.1.0.",
    `Read and follow ${skillPath} exactly.`,
    `Command input (JSON): ${JSON.stringify({ change })}`,
    `Requested change: ${change}`,
    "Return only the structured result required by the supplied output schema.",
  ].join("\n\n");
}

export function manualPlaybookReviewPrompt(
  change: string,
  skillPath: string,
): string {
  return [
    "Invoke the command darrow-delivery:verify-and-repair@0.2.0.",
    `Read and follow ${skillPath} exactly.`,
    `Command input (JSON): ${JSON.stringify({ change })}`,
    `Requested behavior: ${change}`,
    "Return only the structured result required by the supplied output schema.",
  ].join("\n\n");
}
