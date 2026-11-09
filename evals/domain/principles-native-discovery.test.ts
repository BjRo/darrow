import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const oracle = resolve(
  "plugins/capability/darrow-principles/skills/principles-first/evals/fixtures/assert-no-custom-discovery.mjs",
);
const temporary: string[] = [];
afterEach(() =>
  temporary.splice(0).forEach((path) => rmSync(path, { recursive: true })),
);

function check(
  host: "codex" | "claude",
  input: string,
  corrupt = false,
  partial = false,
) {
  const view = mkdtempSync(join(tmpdir(), "principles-native-"));
  temporary.push(view);
  mkdirSync(join(view, host));
  const metadata =
    host === "codex"
      ? {
          type: "session_meta",
          payload: { id: "root", instructions: "custom-principles" },
        }
      : { type: "system", sessionId: "root" };
  const call =
    host === "codex"
      ? { type: "response_item", payload: { type: "custom_tool_call", input } }
      : {
          type: "assistant",
          sessionId: "root",
          message: {
            content: [
              { type: "tool_use", name: "Bash", input: { command: input } },
            ],
          },
        };
  const data = JSON.stringify(metadata) + "\n" + JSON.stringify(call) + "\n";
  writeFileSync(join(view, host, "root.jsonl"), data);
  writeFileSync(
    join(view, "index.json"),
    JSON.stringify({
      format: "sevro.native-transcripts.v2",
      host,
      role: "candidate",
      rootSessionId: "root",
      completeness: partial ? "partial" : "complete",
      issues: [],
      files: [
        {
          path: "root.jsonl",
          sha256: corrupt
            ? "invalid"
            : createHash("sha256").update(data).digest("hex"),
        },
      ],
    }),
  );
  return spawnSync("node", [oracle], {
    env: { ...process.env, SEVRO_CANDIDATE_TRANSCRIPTS: view },
    encoding: "utf8",
  });
}

for (const host of ["codex", "claude"] as const) {
  test(`${host}: selected table read passes despite instruction text mentioning custom paths`, () => {
    expect(check(host, "cat .darrow/principles.md").status).toBe(0);
  });
  test(`${host}: actual recursive listing and unmatched body read are rejected`, () => {
    for (const command of [
      "cat .darrow/principles.md; ls -R .darrow/custom-principles",
      "cat .darrow/custom-principles/unmatched.md",
    ])
      expect(check(host, command).status).toBe(1);
  });
  test(`${host}: partial transcript views cannot establish no discovery`, () => {
    expect(check(host, "cat .darrow/principles.md", false, true).status).toBe(
      1,
    );
  });
  test(`${host}: altered transcript bytes cannot establish no discovery`, () => {
    expect(check(host, "cat .darrow/principles.md", true).status).toBe(1);
  });
}

test("missing public view cannot establish no discovery", () => {
  const env = { ...process.env };
  delete env.SEVRO_CANDIDATE_TRANSCRIPTS;
  expect(spawnSync("node", [oracle], { env }).status).toBe(1);
});
