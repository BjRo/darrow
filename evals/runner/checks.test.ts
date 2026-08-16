import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runChecks, runOutputChecks, runTranscriptChecks } from "./checks";

describe("eval checks", () => {
  test("expect_exact rejects an expected line amid extra output", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-checks-"));
    try {
      const [exact, extra] = await runChecks(repo, [
        {
          name: "exact",
          run: "printf 'expected\\n'",
          expect_exact: "expected",
        },
        {
          name: "extra",
          run: "printf 'expected\\nunrelated\\n'",
          expect_exact: "expected",
        },
      ]);
      expect(exact?.passed).toBe(true);
      expect(extra?.passed).toBe(false);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  test("failed intermediate assertions cannot be hidden by a final marker", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-checks-"));
    try {
      const [result] = await runChecks(repo, [
        {
          name: "fail-fast",
          run: "false; echo reported",
          expect_regex: "reported",
        },
      ]);
      expect(result?.passed).toBe(false);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  test("product-value metrics survive outcome evaluation", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-checks-"));
    try {
      const [escaped, detection, falsePositive] = await runChecks(repo, [
        {
          name: "seeded behavior",
          metric: "escaped_defect",
          run: "true",
        },
        {
          name: "mutation killed",
          metric: "defect_detection",
          run: "true",
        },
        {
          name: "no unsupported finding",
          metric: "false_positive",
          run: "true",
        },
      ]);
      expect(escaped?.metric).toBe("escaped_defect");
      expect(detection?.metric).toBe("defect_detection");
      expect(falsePositive?.metric).toBe("false_positive");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  test("output checks inspect only the normalized final message", async () => {
    const [present, forbidden, exact] = await runOutputChecks(
      '{"verified":true,"summary":"done"}',
      [
        {
          name: "present",
          metric: "defect_detection",
          valid_json: true,
          expect_regex: '"verified"\\s*:\\s*true',
        },
        { name: "forbidden", not_regex: '"verified"\\s*:\\s*false' },
        {
          name: "exact",
          expect_exact: '{"verified":true,"summary":"done"}',
        },
      ],
    );
    expect(present?.passed).toBe(true);
    expect(present?.metric).toBe("defect_detection");
    expect(forbidden?.passed).toBe(true);
    expect(exact?.passed).toBe(true);
  });

  test("output checks reject missing and forbidden content compactly", async () => {
    const [missing, forbidden] = await runOutputChecks('{"verified":false}', [
      { name: "missing", expect_regex: '"verified"\\s*:\\s*true' },
      { name: "forbidden", not_regex: '"verified"\\s*:\\s*false' },
    ]);
    expect(missing?.passed).toBe(false);
    expect(missing?.detail).not.toContain('{"verified":false}');
    expect(forbidden?.passed).toBe(false);
  });

  test("output checks enforce exact regex cardinality", async () => {
    const checks = await runOutputChecks("outcome\tstopped\noutcome\tblocked", [
      {
        name: "one outcome",
        count_regex: "^outcome\\t",
        expect_count: 1,
      },
    ]);
    expect(checks).toEqual([
      expect.objectContaining({
        name: "one outcome",
        passed: false,
        detail: expect.stringContaining("matched 2, expected 1"),
      }),
    ]);
    expect(
      await runOutputChecks("outcome\tstopped", [
        {
          name: "one outcome",
          count_regex: "^outcome\\t",
          expect_count: 1,
        },
      ]),
    ).toEqual([expect.objectContaining({ passed: true })]);
  });

  test("transcript checks inspect only activity after the final boundary", async () => {
    const transcript = [
      "review outcome: blocking",
      '{"type":"commandExecution"}',
      "review outcome: blocking",
      '{"method":"thread/goal/updated","goal":{"status":"blocked"}}',
    ].join("\n");
    const [settled, inactive] = await runTranscriptChecks(transcript, [
      {
        name: "actual goal status",
        after_regex: "review outcome: blocking",
        expect_regex: '"status":"blocked"',
      },
      {
        name: "no later repository activity",
        after_regex: "review outcome: blocking",
        not_regex: '"type":"(commandExecution|fileChange)"',
      },
    ]);
    expect(settled?.passed).toBe(true);
    expect(inactive?.passed).toBe(true);

    const [missingBoundary] = await runTranscriptChecks(transcript, [
      {
        name: "boundary must exist",
        after_regex: "review outcome: clear",
        not_regex: "commandExecution",
      },
    ]);
    expect(missingBoundary?.passed).toBe(false);
    expect(missingBoundary?.detail).toContain("after_regex");
  });

  test("output checks reject prose around a JSON object", async () => {
    const [result] = await runOutputChecks('Result: {"verified":true}', [
      { name: "json only", valid_json: true },
    ]);
    expect(result?.passed).toBe(false);
    expect(result?.detail).toBe("final message is not valid JSON");
  });

  test("output checks accept one isolated JSON fence as host presentation", async () => {
    const [result] = await runOutputChecks('```json\n{"verified":true}\n```', [
      { name: "verdict", json_path: "/verified", expect_json: true },
    ]);
    expect(result?.passed).toBe(true);
  });

  test("output checks reject prose around a fenced JSON object", async () => {
    const [result] = await runOutputChecks(
      'Readiness result:\n```json\n{"verified":true}\n```',
      [{ name: "json only", valid_json: true }],
    );
    expect(result?.passed).toBe(false);
    expect(result?.detail).toBe("final message is not valid JSON");
  });

  test("semantic JSON checks extract one fenced object from host prose", async () => {
    const [result] = await runOutputChecks(
      'Assessment complete.\n```json\n{"verified":true}\n```',
      [{ name: "verdict", json_path: "/verified", expect_json: true }],
    );
    expect(result?.passed).toBe(true);
  });

  test("output checks make order-independent semantic JSON assertions", async () => {
    const [verdict, nested, missing, exact] = await runOutputChecks(
      JSON.stringify({
        verification: [
          {
            diagnosticChecks: [
              {
                exitStatus: 1,
                command: "bun run test",
                nonBlockingReason: "pre-existing runner failure",
              },
            ],
            exitStatus: 0,
          },
        ],
        metadata: { expected: true, extra: true },
        verified: true,
      }),
      [
        { name: "verdict", json_path: "/verified", expect_json: true },
        {
          name: "nested",
          json_path: "/verification",
          contains_json: {
            exitStatus: 0,
            diagnosticChecks: [
              {
                command: "bun run test",
                exitStatus: 1,
                nonBlockingReason: { $regex: "pre-existing|runner" },
              },
            ],
          },
        },
        {
          name: "missing",
          json_path: "/verification",
          contains_json: { command: "verify-remote-contract" },
        },
        {
          name: "exact",
          json_path: "/metadata",
          expect_json: { expected: true },
        },
      ],
    );
    expect(verdict?.passed).toBe(true);
    expect(nested?.passed).toBe(true);
    expect(missing?.passed).toBe(false);
    expect(exact?.passed).toBe(false);
  });

  test("output checks validate the final JSON against a skill schema", async () => {
    const schemaDir = await mkdtemp(join(tmpdir(), "darrow-schema-"));
    try {
      await writeFile(
        join(schemaDir, "output.schema.json"),
        JSON.stringify({
          type: "object",
          required: ["verification"],
          properties: {
            verification: { type: "array", minItems: 1 },
          },
          additionalProperties: true,
        }),
      );
      const valid = { verification: [{ id: "focused" }] };
      const [accepted] = await runOutputChecks(
        JSON.stringify(valid),
        [{ name: "schema", schema: "./output.schema.json" }],
        schemaDir,
      );
      const [rejected] = await runOutputChecks(
        JSON.stringify({ verification: [] }),
        [{ name: "schema", schema: "./output.schema.json" }],
        schemaDir,
      );
      expect(accepted?.passed).toBe(true);
      expect(rejected?.passed).toBe(false);
    } finally {
      await rm(schemaDir, { recursive: true, force: true });
    }
  });
});
