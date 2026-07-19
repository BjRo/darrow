import type { Treatment } from "./types";

export const SHARED_TDD_POLICY =
  "Use Red/Green TDD to implement the requested change. Use an existing focused behavioral test when it covers the requested behavior; otherwise add or adjust one. Run that test before changing production code and confirm it fails because the requested behavior is missing. Then make the smallest change that passes the same test and run the relevant regression tests. If the normal test command fails for an unrelated setup reason, run the focused test directly or through another available command; an unrelated failure is not red.";

export function usesSharedTddPolicy(treatment: Treatment): boolean {
  return treatment === "native" || treatment === "plugins";
}

export function sharedTddPrompt(change: string): string {
  return [`Requested change: ${change}`, SHARED_TDD_POLICY].join("\n\n");
}
