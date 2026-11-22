import { createHash } from "node:crypto";

type RecordValue = Record<string, unknown>;
type MetricsCheck = { id: string; observation: string };
const finalId = "sevro.observation.final-message";

export function contextMetricsCheck(entry: RecordValue, index: number) {
  if (entry.context_metrics === undefined) return null;
  if (
    typeof entry.context_metrics !== "string" ||
    !entry.context_metrics.trim() ||
    Object.keys(entry).some((key) => !["name", "context_metrics"].includes(key))
  )
    throw new Error("context_metrics requires a canonical shell check name");
  return {
    id: `darrow.evals.context-metrics.${index + 1}`,
    grader: "darrow.evals.context-metrics",
    configuration: {},
  };
}

export function contextMetricsPolicy(selected: RecordValue) {
  const shells = selected.checks as RecordValue[];
  const checks = ((selected.output_checks ?? []) as RecordValue[]).flatMap(
    (entry, index) => {
      const check = contextMetricsCheck(entry, index);
      if (!check) return [];
      const matches = shells.flatMap((shell, i) =>
        shell.name === entry.context_metrics ? [i] : [],
      );
      const shell = matches.length === 1 ? shells[matches[0]!] : null;
      if (
        !shell?.expect_regex ||
        (shell.exit_code ?? shell.expect_exit ?? 0) !== 0
      )
        throw new Error(
          "context_metrics requires one successful capturing shell check",
        );
      return [
        {
          id: check.id,
          observation: `sevro.observation.shell.darrow.shell.${matches[0]! + 1}`,
        },
      ];
    },
  );
  return {
    requiredEvidence: checks.length
      ? [finalId, ...checks.map((check) => check.observation)]
      : [],
    details: checks.length ? { contextMetricsChecks: checks } : {},
  };
}

function complete(observations: unknown, id: string, sources: string[]) {
  if (!Array.isArray(observations)) return null;
  const matches = observations.filter((entry) => entry?.id === id);
  const entry = matches.length === 1 ? matches[0] : null;
  return entry?.completeness === "complete" && sources.includes(entry.source)
    ? (entry.data as RecordValue | undefined)
    : null;
}

// Doctor's public contract specifies two explicit before/after lines per host.
function reportedMetrics(text: string): string | null {
  const plain = text.replace(/[*`]/g, "");
  const rows = [];
  for (const host of ["codex", "claude"]) {
    const values = [];
    for (const unit of ["bytes", "tokens"]) {
      const pattern = new RegExp(
        `^\\s*${host} ${unit}: before (\\d+) ~?${unit}; after (\\d+) ~?${unit}\\s*$`,
        "gim",
      );
      const matches = [...plain.matchAll(pattern)];
      if (matches.length !== 1) return null;
      values.push(matches[0]![1]!, matches[0]![2]!);
    }
    rows.push(`${host} ${values[0]} ${values[2]} ${values[1]} ${values[3]}\n`);
  }
  return rows.join("");
}

function validCanonical(canonical: RecordValue | null | undefined) {
  return (
    canonical?.exitCode === 0 &&
    canonical.expectedExitCode === 0 &&
    typeof canonical.stdoutSha256 === "string" &&
    /^[a-f0-9]{64}$/.test(canonical.stdoutSha256) &&
    Number.isSafeInteger(canonical.stdoutByteLength) &&
    Number(canonical.stdoutByteLength) > 0
  );
}

export function contextMetricsOutcomes(value: unknown, observations: unknown) {
  const checks = (value ?? []) as MetricsCheck[];
  const final = complete(observations, finalId, [
    "sevro.host.codex",
    "sevro.host.claude",
  ]);
  const text = final?.text;
  return checks.map((check) => {
    const canonical = complete(observations, check.observation, [
      "sevro.shell",
    ]);
    const available = typeof text === "string" && validCanonical(canonical);
    const reported = typeof text === "string" ? reportedMetrics(text) : null;
    const matches =
      reported !== null &&
      createHash("sha256").update(reported).digest("hex") ===
        canonical?.stdoutSha256 &&
      Buffer.byteLength(reported) === canonical?.stdoutByteLength;
    return {
      id: check.id,
      status: !available ? "unavailable" : matches ? "passed" : "failed",
      evidenceRefs: available ? [finalId, check.observation] : [],
      detail:
        "Reported runtime metrics match the independently inspected repository",
    };
  });
}
