import type { CheckResult } from "./types";

type Evidence = Record<string, unknown>;
const statuses = new Set([
  "active",
  "paused",
  "blocked",
  "usageLimited",
  "budgetLimited",
  "complete",
]);

function object(value: unknown): Evidence {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed native goal observation");
  return value as Evidence;
}

function observation(raw: string): Evidence {
  const records = raw
    .split("\n")
    .filter(Boolean)
    .map((line) => object(JSON.parse(line)));
  const summaries = records.filter(
    (item) =>
      item.type === "darrow.eval.app_server" ||
      item.type === "darrow.eval.claude_native_goal",
  );
  if (summaries.length !== 1)
    throw new Error("One complete native host observation is required");
  const result = summaries[0]!;
  if (typeof result.threadId !== "string" || !result.threadId || result.failure)
    throw new Error(
      "Missing original-thread identity or failed native observation",
    );
  if (!Array.isArray(result.goals))
    throw new Error("Missing native goal history");
  return result;
}

function validateHistory(values: unknown[]): Evidence[] {
  const goals = values.map(object);
  for (const goal of goals) {
    if (!statuses.has(String(goal.status)))
      throw new Error("Unknown native goal state");
    if (
      typeof goal.characters !== "number" ||
      !Number.isInteger(goal.characters) ||
      goal.characters < 1 ||
      goal.characters > 4000
    )
      throw new Error("Native goal must contain 1–4,000 Unicode characters");
  }
  const complete = goals.findIndex((goal) => goal.status === "complete");
  if (
    complete >= 0 &&
    goals.slice(complete + 1).some((goal) => goal.status !== "complete")
  )
    throw new Error("A completed goal was replaced or restarted");
  return goals;
}

/** Activation evidence only; task correctness and capability use are independent. */
export function nativeGoalCheck(
  raw: string,
  expected: "required" | "forbidden",
): CheckResult {
  const name = `native main-thread goal activation is ${expected}`;
  try {
    const result = observation(raw);
    const goals = validateHistory(result.goals as unknown[]);
    const activated =
      goals.length > 0 && statuses.has(String(result.goalStatus));
    const absent = goals.length === 0 && result.goalStatus === null;
    const passed = expected === "required" ? activated : absent;
    return {
      name,
      passed,
      detail: passed
        ? "Native goal readback and lifecycle satisfy the expectation"
        : "Native goal history does not satisfy the expectation",
    };
  } catch (error) {
    return {
      name,
      passed: false,
      detail:
        error instanceof Error ? error.message : "Native evidence unavailable",
    };
  }
}
