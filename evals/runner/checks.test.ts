import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runChecks } from "./checks";

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
});
