import type { Treatment } from "./types";

export function usesMatchedPolicy(treatment: Treatment): boolean {
  return (
    treatment === "native-matched-policy" ||
    treatment === "plugins-matched-policy"
  );
}

export function matchedPolicyPrompt(change: string): string {
  return [
    "Implement the requested change using this evaluator-matched TDD policy.",
    `Requested change: ${change}`,
    "Create and switch to one well-named local branch for the change.",
    "Inspect only the repository context needed to locate the implementation and tests.",
    "Add or adjust one focused behavior-facing test through a public or otherwise observable seam.",
    "Run it before implementation and confirm it fails because the requested behavior is absent.",
    "A missing runner, dependency, fixture, unrelated compile error, or generic nonzero exit is not meaningful red. Do not install dependencies.",
    "Make the smallest sufficient implementation.",
    "Run the identical focused test until it passes, then run the relevant regression suite and typecheck when applicable.",
    "Review the diff for scope and correctness.",
    "Do not commit, push, open a pull request, mutate a ticket, change dependencies, or weaken existing tests.",
  ].join("\n");
}
