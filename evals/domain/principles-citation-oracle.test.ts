import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const oracle = resolve(
  "plugins/capability/darrow-pstack/skills/principles-first/evals/fixtures/assert-cited-principles-read.mjs",
);
const routes = [
  "ledger-parse-once=parse-once.md",
  "ledger-one-writer=one-writer.md",
  "release-tone=release-tone.md",
];
const temporary: string[] = [];
afterEach(() =>
  temporary.splice(0).forEach((path) => rmSync(path, { recursive: true })),
);

type Options = { corrupt?: boolean; partial?: boolean; sidechain?: boolean };

function rows(
  host: "codex" | "claude",
  command: string,
  reply: string,
  options: Options,
) {
  if (host === "codex")
    return [
      { type: "session_meta", payload: { id: "root" } },
      {
        type: "response_item",
        payload: {
          type: "function_call",
          arguments: JSON.stringify({ cmd: command }),
        },
      },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: reply }],
        },
      },
    ];
  return [
    { type: "system", sessionId: "root" },
    {
      type: "assistant",
      sessionId: "root",
      message: {
        content: [{ type: "tool_use", name: "Bash", input: { command } }],
      },
    },
    {
      type: "assistant",
      sessionId: "root",
      isSidechain: options.sidechain === true,
      message: { content: [{ type: "text", text: reply }] },
    },
  ];
}

function check(
  host: "codex" | "claude",
  command: string,
  reply: string,
  options: Options = {},
) {
  const view = mkdtempSync(join(tmpdir(), "principles-citation-"));
  temporary.push(view);
  mkdirSync(join(view, host));
  const data =
    rows(host, command, reply, options)
      .map((row) => JSON.stringify(row))
      .join("\n") + "\n";
  writeFileSync(join(view, host, "root.jsonl"), data);
  writeFileSync(
    join(view, "index.json"),
    JSON.stringify({
      format: "sevro.native-transcripts.v2",
      host,
      role: "candidate",
      rootSessionId: "root",
      completeness: options.partial ? "partial" : "complete",
      issues: [],
      files: [
        {
          path: "root.jsonl",
          sha256: options.corrupt
            ? "invalid"
            : createHash("sha256").update(data).digest("hex"),
        },
      ],
    }),
  );
  return spawnSync("node", [oracle, ...routes], {
    env: { ...process.env, SEVRO_CANDIDATE_TRANSCRIPTS: view },
    encoding: "utf8",
  });
}

const readBoth =
  "cat .darrow/principles.md .darrow/custom-principles/parse-once.md .darrow/custom-principles/one-writer.md";
const citeBoth =
  "Applying ledger-parse-once moves parsing before the workers; ledger-one-writer gives balances one writer.";

for (const host of ["codex", "claude"] as const) {
  test(`${host}: citations of opened principle files pass`, () => {
    expect(check(host, readBoth, citeBoth).status).toBe(0);
  });
  test(`${host}: a citation of an unopened principle file fails`, () => {
    const result = check(
      host,
      "cat .darrow/principles.md .darrow/custom-principles/parse-once.md",
      citeBoth,
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("cited ledger-one-writer without opening");
  });
  test(`${host}: reading the table alone does not count as opening a principle`, () => {
    expect(
      check(host, "cat .darrow/principles.md", "Applied ledger-parse-once.")
        .status,
    ).toBe(1);
  });
  test(`${host}: a reply without any route ID fails`, () => {
    expect(
      check(host, readBoth, "Parse rows once and use one writer.").status,
    ).toBe(1);
  });
  test(`${host}: a longer token containing a route ID is not a citation`, () => {
    expect(
      check(
        host,
        readBoth,
        "Applied ledger-parse-once and not-release-tone-ish.",
      ).status,
    ).toBe(0);
  });
  test(`${host}: partial or altered transcripts cannot establish citations`, () => {
    expect(check(host, readBoth, citeBoth, { partial: true }).status).toBe(1);
    expect(check(host, readBoth, citeBoth, { corrupt: true }).status).toBe(1);
  });
}

test("claude: subagent text is not the root agent's citation", () => {
  expect(check("claude", readBoth, citeBoth, { sidechain: true }).status).toBe(
    1,
  );
});

test("missing public view cannot establish citations", () => {
  const env = { ...process.env };
  delete env.SEVRO_CANDIDATE_TRANSCRIPTS;
  expect(spawnSync("node", [oracle, ...routes], { env }).status).toBe(1);
});
