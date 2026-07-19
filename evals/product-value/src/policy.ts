import { chmod, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Treatment } from "./types";
import { command } from "./process";

export interface MatchedPolicy {
  evidenceDirectory: string;
  evidenceScript: string;
  outputSchema: string;
}

export function usesMatchedPolicy(treatment: Treatment): boolean {
  return (
    treatment === "native-matched-policy" ||
    treatment === "plugins-matched-policy"
  );
}

function codexCompatibleSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(codexCompatibleSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      key === "uniqueItems" ? [] : [[key, codexCompatibleSchema(item)]],
    ),
  );
}

export async function installMatchedPolicy(
  repo: string,
  pluginRoot: string,
): Promise<MatchedPolicy> {
  const root = join(repo, ".evaluation", "matched-policy");
  const evidenceScript = join(root, "evidence.sh");
  const evidenceDirectory = join(root, "evidence");
  const outputSchema = join(root, "output.schema.json");
  const implementRoot = resolve(
    pluginRoot,
    "darrow-delivery",
    "skills",
    "implement",
  );
  await mkdir(root, { recursive: true });
  await cp(join(implementRoot, "scripts", "evidence.sh"), evidenceScript);
  await chmod(evidenceScript, 0o755);
  const schema = JSON.parse(
    await readFile(join(implementRoot, "output.schema.json"), "utf8"),
  );
  await writeFile(
    outputSchema,
    JSON.stringify(codexCompatibleSchema(schema), null, 2) + "\n",
  );
  await writeFile(join(repo, ".git", "info", "exclude"), "/.evaluation/\n", {
    flag: "a",
  });
  return { evidenceDirectory, evidenceScript, outputSchema };
}

export function matchedPolicyPrompt(
  change: string,
  policy: MatchedPolicy,
): string {
  return [
    "Implement the requested change using this evaluator-matched TDD policy.",
    `Requested change: ${change}`,
    "Create and switch to one well-named local branch for the change.",
    "Inspect only the repository context needed to locate the implementation and tests.",
    "Add or adjust one focused test that specifies the requested behavior.",
    "Before implementation, record meaningful behavioral red with:",
    `bash ${policy.evidenceScript} run ${policy.evidenceDirectory} red --expected <behavioral-failure-text> -- <focused-test-command> [args...]`,
    "A missing runner, dependency, executable, fixture, unrelated compile error, or generic nonzero exit is not meaningful red. Do not install dependencies.",
    "Make the smallest sufficient implementation.",
    "Record green with exactly the same focused command and arguments:",
    `bash ${policy.evidenceScript} run ${policy.evidenceDirectory} green -- <focused-test-command> [args...]`,
    "Record the relevant regression suite:",
    `bash ${policy.evidenceScript} run ${policy.evidenceDirectory} regression -- <regression-command> [args...]`,
    `Validate the completed sequence with: bash ${policy.evidenceScript} validate ${policy.evidenceDirectory}`,
    "Do not commit, push, open a pull request, mutate a ticket, change dependencies, weaken existing tests, or bypass/edit the evidence records.",
    "Return only the structured JSON required by the supplied output schema: branch, summary, changedPaths, and red/green/regression evidence.",
  ].join("\n");
}

export async function validateMatchedPolicyEvidence(
  repo: string,
  policy: MatchedPolicy,
): Promise<boolean> {
  const validation = await command(
    ["/bin/bash", policy.evidenceScript, "validate", policy.evidenceDirectory],
    repo,
  );
  return validation.code === 0;
}
