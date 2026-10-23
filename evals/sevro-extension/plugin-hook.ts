type RecordValue = Record<string, unknown>;
const ID = "darrow.evals.plugin-hook";
const EVIDENCE = "sevro.host.hooks";

export function pluginHookPolicy(
  value: unknown,
  skillDir: string | null,
  withoutSkill = false,
) {
  if (value === undefined)
    return { checks: [], requiredEvidence: [], details: {} };
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]*$/.test(value))
    throw new Error("required_plugin_hook must name one plugin");
  if (!skillDir || skillDir.startsWith(".agents/"))
    throw new Error("required_plugin_hook requires a plugin-local case");
  if (withoutSkill) return { checks: [], requiredEvidence: [], details: {} };
  return {
    checks: [{ id: ID, grader: ID, configuration: {} }],
    requiredEvidence: [EVIDENCE],
    details: { requiredPluginHook: value },
  };
}

function object(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function plugins(value: unknown): RecordValue[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map(object);
  if (
    rows.some(
      (row) =>
        !row ||
        typeof row.name !== "string" ||
        typeof row.allowed !== "boolean" ||
        !/^[a-f0-9]{64}$/.test(String(row.sourceDigest)) ||
        !/^[a-f0-9]{64}$/.test(String(row.effectiveDigest)),
    )
  )
    return null;
  const result = rows as RecordValue[];
  return new Set(result.map((row) => row.name)).size === result.length
    ? result
    : null;
}

function executions(value: unknown): RecordValue[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map(object);
  return rows.every(
    (row) =>
      row &&
      row.status === "completed" &&
      Number.isSafeInteger(row.pid) &&
      Number(row.pid) > 0 &&
      Number.isSafeInteger(row.exitCode) &&
      Number(row.exitCode) >= 0,
  )
    ? (rows as RecordValue[])
    : null;
}

function hookResult(
  selected: RecordValue[],
  calls: RecordValue[],
  required: string,
) {
  const target = selected.find((row) => row.name === required);
  if (!target || target.allowed !== true)
    return {
      status: "failed",
      detail: "Required plugin hook was not installed and allowed",
    };
  if (selected.some((row) => row.name !== required && row.allowed === true))
    return {
      status: "unavailable",
      detail:
        "Hook executions cannot be attributed among multiple allowed plugins",
    };
  const success = calls.length > 0 && calls.every((row) => row.exitCode === 0);
  return {
    status: success ? "passed" : "failed",
    detail: success
      ? "Required plugin hook completed successfully"
      : "Required plugin hook did not execute or returned a failure",
  };
}

function hookReceipt(observations: unknown) {
  const matches = Array.isArray(observations)
    ? observations.map(object).filter((row) => row?.id === EVIDENCE)
    : [];
  const receipt = matches.length === 1 ? matches[0] : null;
  return receipt?.completeness === "complete" &&
    ["sevro.host.codex", "sevro.host.claude"].includes(String(receipt.source))
    ? object(receipt.data)
    : null;
}

export function pluginHookChecks(required: unknown, observations: unknown) {
  if (required === undefined) return [];
  if (typeof required !== "string" || !/^[a-z][a-z0-9-]*$/.test(required))
    throw new Error("invalid required plugin hook");
  const data = hookReceipt(observations);
  const selected = plugins(data?.plugins);
  const calls = executions(data?.executions);
  const result =
    selected && calls
      ? hookResult(selected, calls, required)
      : {
          status: "unavailable",
          detail:
            "Plugin hook execution evidence is missing, partial, or malformed",
        };
  return [{ id: ID, ...result, evidenceRefs: data ? [EVIDENCE] : [] }];
}
