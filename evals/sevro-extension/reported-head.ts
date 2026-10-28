type RecordValue = Record<string, unknown>;
const finalId = "sevro.observation.final-message";
const headId = "sevro.observation.git-head";

export function reportedHeadCheck(entry: RecordValue, index: number) {
  if (entry.reported_head === undefined) return null;
  if (
    entry.reported_head !== true ||
    Object.keys(entry).some((key) => !["name", "reported_head"].includes(key))
  )
    throw new Error("reported_head requires true and a check name only");
  return {
    id: `darrow.evals.reported-head.${index + 1}`,
    grader: "darrow.evals.reported-head",
    configuration: {},
  };
}

export function reportedHeadPolicy(selected: RecordValue) {
  const checks = ((selected.output_checks ?? []) as RecordValue[]).flatMap(
    (entry, index) => {
      const check = reportedHeadCheck(entry, index);
      return check ? [check.id] : [];
    },
  );
  if (checks.length && typeof selected.expect_head_change !== "boolean")
    throw new Error("reported_head requires captured Git HEAD checks");
  return {
    requiredEvidence: checks.length ? [finalId, headId] : [],
    details: checks.length ? { reportedHeadChecks: checks } : {},
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

export function reportedHeadOutcomes(value: unknown, observations: unknown) {
  const ids = (value ?? []) as string[];
  const final = complete(observations, finalId, [
    "sevro.host.codex",
    "sevro.host.claude",
  ]);
  const head = complete(observations, headId, ["sevro.git-head"]);
  const text = final?.text;
  const revision = head?.currentRevision;
  const available =
    typeof text === "string" &&
    typeof revision === "string" &&
    /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(revision);
  const reported = available
    ? [...text.matchAll(/\b[0-9a-f]{7,64}\b/g)].some((match) =>
        revision.startsWith(match[0]),
      )
    : false;
  return ids.map((id) => ({
    id,
    status: !available ? "unavailable" : reported ? "passed" : "failed",
    evidenceRefs: [finalId, headId],
    detail: "Reported commit matches the captured final Git revision",
  }));
}
