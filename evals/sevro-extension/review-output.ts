import { createHash } from "node:crypto";

type RecordValue = Record<string, unknown>;
type ReviewOutput = {
  id: string;
  format: "human" | "machine";
  canonicalObservation?: string;
};

function object(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

export function reviewOutputCheck(entry: RecordValue, index: number) {
  if (entry.review_format === undefined) return null;
  const allowed = ["name", "review_format", "canonical_check"];
  if (
    Object.keys(entry).some((key) => !allowed.includes(key)) ||
    !["human", "machine"].includes(String(entry.review_format)) ||
    (entry.review_format === "human" && entry.canonical_check !== undefined) ||
    (entry.review_format === "machine" &&
      (typeof entry.canonical_check !== "string" ||
        !entry.canonical_check.trim()))
  )
    throw new Error("invalid Review presentation output check");
  return {
    id: `darrow.evals.review-output.${index + 1}`,
    grader: "darrow.evals.review-output",
    configuration: {},
  };
}

export function reviewOutputPolicy(selected: RecordValue) {
  const outputs = (selected.output_checks ?? []) as RecordValue[];
  const shells = selected.checks as RecordValue[];
  const checks = outputs.flatMap<ReviewOutput>((entry, index) => {
    const check = reviewOutputCheck(entry, index);
    if (!check) return [];
    const format = entry.review_format as ReviewOutput["format"];
    if (format === "human") return [{ id: check.id, format }];
    const matches = shells.flatMap((shell, i) =>
      shell.name === entry.canonical_check ? [i] : [],
    );
    if (matches.length !== 1 || !shells[matches[0]!]!.expect_regex)
      throw new Error(
        "Review machine output requires one capturing canonical shell check",
      );
    return [
      {
        id: check.id,
        format,
        canonicalObservation: `sevro.observation.shell.darrow.shell.${matches[0]! + 1}`,
      },
    ];
  });
  return {
    requiredEvidence: checks.length
      ? [
          "sevro.observation.final-message",
          ...checks.flatMap((check) =>
            check.canonicalObservation ? [check.canonicalObservation] : [],
          ),
        ]
      : [],
    details: checks.length ? { reviewOutputChecks: checks } : {},
  };
}

function completeObservation(
  observations: unknown,
  id: string,
  sources: string[],
) {
  if (!Array.isArray(observations)) return null;
  const matches = observations.filter((entry) => object(entry)?.id === id);
  const observation = matches.length === 1 ? object(matches[0]) : null;
  return observation?.completeness === "complete" &&
    sources.includes(String(observation.source))
    ? object(observation.data)
    : null;
}

function reviewRecord(value: unknown) {
  return ["darrow-review-result-v3", "darrow-review-verification-v3"].includes(
    String(object(value)?.format),
  );
}

function jsonAt(text: string, start: number): unknown {
  let depth = 0;
  for (const token of text.slice(start).matchAll(/"(?:[^"\\]|\\.)*"|[{}]/g)) {
    if (token[0] === "{") depth++;
    else if (token[0] === "}" && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, start + token.index! + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function embeddedRecord(text: string) {
  for (
    let start = text.indexOf("{");
    start !== -1;
    start = text.indexOf("{", start + 1)
  ) {
    if (reviewRecord(jsonAt(text, start))) return true;
  }
  return false;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  const record = object(value);
  return record
    ? Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((key) => [key, normalize(record[key])]),
      )
    : value;
}

function validCanonical(canonical: RecordValue | null) {
  return (
    canonical?.exitCode === 0 &&
    canonical.expectedExitCode === 0 &&
    typeof canonical.stdoutSha256 === "string" &&
    /^[a-f0-9]{64}$/.test(canonical.stdoutSha256) &&
    Number.isSafeInteger(canonical.stdoutByteLength) &&
    Number(canonical.stdoutByteLength) > 0
  );
}

function machineStatus(
  check: ReviewOutput,
  text: string,
  observations: unknown,
) {
  const canonical = completeObservation(
    observations,
    check.canonicalObservation!,
    ["sevro.shell"],
  );
  if (!canonical || !validCanonical(canonical)) return "unavailable";
  try {
    const parsed: unknown = JSON.parse(text);
    if (!reviewRecord(parsed)) return "failed";
    const normalized = `${JSON.stringify(normalize(parsed))}\n`;
    return createHash("sha256").update(normalized).digest("hex") ===
      canonical.stdoutSha256 &&
      Buffer.byteLength(normalized) === canonical.stdoutByteLength
      ? "passed"
      : "failed";
  } catch {
    return "failed";
  }
}

export function reviewOutputOutcomes(value: unknown, observations: unknown) {
  const checks = (value ?? []) as ReviewOutput[];
  const final = completeObservation(
    observations,
    "sevro.observation.final-message",
    ["sevro.host.codex", "sevro.host.claude"],
  );
  const text = typeof final?.text === "string" ? final.text : null;
  return checks.map((check) => ({
    id: check.id,
    status:
      text === null
        ? "unavailable"
        : check.format === "human"
          ? embeddedRecord(text)
            ? "failed"
            : "passed"
          : machineStatus(check, text, observations),
    evidenceRefs: [
      "sevro.observation.final-message",
      ...(check.canonicalObservation ? [check.canonicalObservation] : []),
    ],
    detail:
      check.format === "human"
        ? "Human response excludes canonical machine records"
        : "Machine response equals the retained canonical review record",
  }));
}
