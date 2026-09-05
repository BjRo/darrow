import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { destroyFixture } from "./fixture";
import {
  runChecks,
  runOutputChecks,
  runTranscriptChecks,
  validateRegexChecks,
} from "./checks";

describe("eval checks", () => {
  test.each(["result", "execution error"])(
    "cleanup failure preserves the original %s and reports retained scratch",
    async (outcome) => {
      const repo = await mkdtemp(join(tmpdir(), "darrow-checks-cleanup-"));
      const bin = join(repo, "bin");
      const capture = join(repo, "cleanup-root");
      try {
        await mkdir(bin);
        await writeFile(
          join(bin, "chmod"),
          '#!/bin/sh\nprintf "%s" "$3" >"$DARROW_CLEANUP_TEST_CAPTURE"\nprintf cleanup-unavailable >&2\nexit 1\n',
          { mode: 0o755 },
        );
        const script = join(repo, "check.ts");
        await writeFile(
          script,
          `
import { runChecks } from ${JSON.stringify(join(import.meta.dir, "checks.ts"))};
try {
  const results = await runChecks(process.argv[2], [
    { name: "completed check", run: "true" },
  ]);
  console.log(JSON.stringify({ results }));
} catch (error) {
  console.log(JSON.stringify({ error: String(error) }));
}
`,
        );
        const proc = Bun.spawn(
          [
            process.execPath,
            script,
            outcome === "result" ? repo : join(repo, "missing"),
          ],
          {
            stdout: "pipe",
            stderr: "pipe",
            env: {
              ...process.env,
              PATH: `${bin}:${process.env.PATH}`,
              DARROW_CLEANUP_TEST_CAPTURE: capture,
            },
          },
        );
        const [stdout, stderr, code] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
          proc.exited,
        ]);
        expect(code).toBe(0);
        const observed = JSON.parse(stdout);
        if (outcome === "result") {
          expect(observed.results).toEqual([
            { name: "completed check", passed: true, detail: "ok" },
          ]);
        } else {
          expect(observed.error).toContain("ENOENT");
        }
        const stateRoot = await readFile(capture, "utf8");
        expect(existsSync(stateRoot)).toBe(true);
        expect(stderr).toContain(`Grading scratch retained at ${stateRoot}:`);
        expect(stderr).toContain("cleanup-unavailable");
      } finally {
        if (existsSync(capture))
          await destroyFixture(await readFile(capture, "utf8"));
        await destroyFixture(repo);
      }
    },
  );

  test.each([0, 7])(
    "read-only grading caches preserve check outcomes (exit %i)",
    async (exitCode) => {
      const repo = await mkdtemp(join(tmpdir(), "darrow-checks-cache-"));
      let stateRoot: string | undefined;
      try {
        const [result] = await runChecks(repo, [
          {
            name: "check creates a read-only dependency cache",
            run: `
printf '%s' "$HOME" >grading-home
mkdir -p "$HOME/go/pkg/mod/example"
printf cached >"$HOME/go/pkg/mod/example/module"
chmod 555 "$HOME/go/pkg/mod/example"
exit ${exitCode}
`,
          },
        ]);
        stateRoot = dirname(await readFile(join(repo, "grading-home"), "utf8"));
        expect(result).toMatchObject({
          name: "check creates a read-only dependency cache",
          passed: exitCode === 0,
          detail: exitCode === 0 ? "ok" : expect.stringContaining("exit=7"),
        });
        expect(existsSync(stateRoot)).toBe(false);
      } finally {
        if (existsSync(join(repo, "grading-home"))) {
          stateRoot = dirname(
            await readFile(join(repo, "grading-home"), "utf8"),
          );
          await destroyFixture(stateRoot);
        }
        await destroyFixture(repo);
      }
    },
  );

  test.skipIf(process.platform !== "darwin")(
    "candidate grading retains isolation and a private environment",
    async () => {
      const repo = await mkdtemp(join(tmpdir(), "darrow-eval-grading-test-"));
      const peer = await mkdtemp(join(tmpdir(), "darrow-eval-grading-peer-"));
      const original = process.env.DARROW_GRADING_SENTINEL;
      process.env.DARROW_GRADING_SENTINEL = "host-only";
      try {
        const credentials = join(repo, ".git/darrow-eval/state/codex/config");
        await mkdir(credentials, { recursive: true });
        await writeFile(join(credentials, "auth.json"), "fixture-credential");
        await writeFile(join(peer, "private"), "peer-evidence");
        await writeFile(join(repo, "README.md"), "fixture");
        await writeFile(
          join(repo, "candidate.sh"),
          `
test -z "\${DARROW_GRADING_SENTINEL:-}" || exit 10
test "$HOME" != "$HOST_HOME" || exit 11
if cat "$SOURCE_FILE" >/dev/null 2>&1; then exit 12; fi
if cat "$PEER_FILE" >/dev/null 2>&1; then exit 13; fi
if cat .git/darrow-eval/state/codex/config/auth.json >/dev/null 2>&1; then exit 14; fi
test -f README.md
printf fixture-ok
`,
        );
        const [result] = await runChecks(
          repo,
          [
            {
              name: "isolated candidate script",
              run: "sh candidate.sh",
              expect_exact: "fixture-ok",
            },
          ],
          {
            HOST_HOME: process.env.HOME ?? "",
            SOURCE_FILE: join(import.meta.dir, "types.ts"),
            PEER_FILE: join(peer, "private"),
          },
        );
        expect(result).toMatchObject({ passed: true, detail: "ok" });
      } finally {
        if (original === undefined) delete process.env.DARROW_GRADING_SENTINEL;
        else process.env.DARROW_GRADING_SENTINEL = original;
        await Promise.all(
          [repo, peer].map((path) =>
            rm(path, { recursive: true, force: true }),
          ),
        );
      }
    },
  );

  test("invalid regular expressions fail preflight before harness execution", () => {
    expect(
      validateRegexChecks(
        [
          {
            name: "unsupported inline flag",
            not_regex: "(?i)forbidden",
          },
        ],
        "example output_checks",
      ),
    ).toEqual([
      expect.stringContaining(
        "example output_checks unsupported inline flag: invalid not_regex",
      ),
    ]);
    expect(
      validateRegexChecks(
        [{ name: "supported flag", not_regex: "forbidden", flags: "i" }],
        "example output_checks",
      ),
    ).toEqual([]);
  });

  test("run checks receive explicit harness route environment", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-checks-"));
    try {
      const [result] = await runChecks(
        repo,
        [
          {
            name: "route",
            run: 'test "$DARROW_EVAL_HARNESS" = codex && test "$DARROW_EVAL_MODEL" = gpt-5.6-terra && test "$DARROW_EVAL_EFFORT" = high',
          },
        ],
        {
          DARROW_EVAL_HARNESS: "codex",
          DARROW_EVAL_MODEL: "gpt-5.6-terra",
          DARROW_EVAL_EFFORT: "high",
        },
      );
      expect(result?.passed).toBe(true);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

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
