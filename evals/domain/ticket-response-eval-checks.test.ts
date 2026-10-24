import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";

const source = new URL(
  "../../plugins/capability/darrow-tickets/skills/read-ticket/evals/direct-id.yaml",
  import.meta.url,
);
const response = [
  "backend: github",
  "ticket-id: 12",
  "#12 open — Preserve exact ticket bodies",
  "https://github.test/o/r/issues/12",
  "labels: enhancement, area: tickets",
  "parent: #7",
  "depends-on: #3",
  "## body",
  "## Motivation",
  "",
  "Callers need TOKEN-ALPHA verbatim.",
  "",
  "## Acceptance criteria",
  "",
  "- Preserve TOKEN-BETA exactly.",
].join("\n");

for (const [name, finalMessage, expected] of [
  ["without a terminal newline", response, "passed"],
  ["with one terminal newline", response + "\n", "passed"],
  ["with a preamble", "Here is the ticket:\n" + response, "failed"],
  ["with appended commentary", response + "\nPlease review it.", "failed"],
  [
    "with a redacted ticket identifier",
    response.replace("ticket-id: 12", "ticket-id: [REDACTED:API key param]"),
    "failed",
  ],
  [
    "with the former ticket field",
    response.replace("ticket-id: 12", "ticket-token: 12"),
    "failed",
  ],
  [
    "with a changed body token",
    response.replace("TOKEN-BETA", "TOKEN-OTHER"),
    "failed",
  ],
  ["with two terminal newlines", response + "\n\n", "failed"],
] as const) {
  test(`ticket response oracle grades ${name}`, async () => {
    const canonical = await readFixtureCase(source);
    const completeOutput = canonical.output_checks?.find(
      (check) => check.name === "complete CLI output is relayed",
    );
    if (!completeOutput) throw new Error("ticket output oracle missing");
    const result = await runFixtureChecks({
      source,
      checks: [],
      outputChecks: [completeOutput],
      finalMessage,
    });
    expect(result.value.execution.status, result.diagnostic).toBe("completed");
    expect(result.value.grading.status, result.diagnostic).toBe("completed");
    expect(
      result.value.cases[0]?.trials[0]?.checks[0]?.status,
      result.diagnostic,
    ).toBe(expected);
  }, 120_000);
}
