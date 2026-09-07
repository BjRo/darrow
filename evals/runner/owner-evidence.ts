import type { CheckResult, GoalRoute } from "./types";

/** Native acceptance proves the applied route; it does not expose the contract. */
function evidenceRecords(raw: string): Record<string, unknown>[] | undefined {
  const records: Record<string, unknown>[] = [];
  try {
    for (const line of raw.split("\n").filter(Boolean)) {
      const record: unknown = JSON.parse(line);
      if (!record || typeof record !== "object" || Array.isArray(record))
        return;
      records.push(record as Record<string, unknown>);
    }
  } catch {
    return;
  }
  return records;
}

export function effectiveNativeOwnerRoute(raw: string): GoalRoute | undefined {
  const records = evidenceRecords(raw);
  if (
    !records ||
    records.some(
      (record) => record.type === "darrow.codex_native_session_malformed",
    )
  )
    return;
  const accepted = records.filter(
    (record) => record.type === "darrow.codex_native_single_agent_accepted",
  );
  if (accepted.length !== 1) return;
  const record = accepted[0]!;
  if (
    record.fork_turns !== "none" ||
    typeof record.model !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(record.model) ||
    typeof record.reasoning_effort !== "string" ||
    !/^(low|medium|high|xhigh|max|ultra)$/.test(record.reasoning_effort)
  )
    return;
  return {
    harness: "codex",
    provider: "openai",
    model: record.model,
    effort: record.reasoning_effort,
  };
}

export function effectiveOwnerRouteCheck(
  raw: string,
  expected: { model: string; effort: string },
): CheckResult {
  const observed = effectiveNativeOwnerRoute(raw);
  return {
    name: "native owner effective route matches expectation",
    passed:
      observed?.model === expected.model && observed.effort === expected.effort,
    detail: `expected one accepted owner at ${expected.model}/${expected.effort}; observed ${observed ? `${observed.model}/${observed.effort}` : "unverified"}; contract selection is not inferred`,
  };
}
