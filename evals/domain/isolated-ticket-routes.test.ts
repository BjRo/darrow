import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

const review = resolve("plugins/capability/darrow-review/backend/tests/evals");
const adaptive = resolve("plugins/orchestration/darrow-adaptive-goal");
type Mutation =
  "valid" | "wrong route" | "missing reader" | "unfinished reader";

function runOracle(host: "codex" | "claude", mutation: Mutation) {
  const root = mkdtempSync(join(tmpdir(), "darrow-isolated-routes-"));
  try {
    const helpers = join(root, ".git/eval-checks/review/tests/evals");
    cpSync(review, helpers, { recursive: true });
    const wrapper = join(
      adaptive,
      "backend/tests/evals/isolated_ticket_routes.py",
    );
    if (existsSync(wrapper))
      cpSync(wrapper, join(root, ".git/eval-checks/isolated_ticket_routes.py"));
    const state = join(root, "reviews");
    const scope = join(state, "darrow-review.fixture");
    mkdirSync(scope, { recursive: true });
    writeFileSync(join(scope, "result.json"), "{}\n");
    writeFileSync(join(scope, "reviewer-route.json"), "{}\n");
    const model = host === "codex" ? "gpt-6.1-sol" : "claude-opus-5-5";
    const route = {
      host,
      provider: host === "codex" ? "openai" : "anthropic",
      model,
      effort: "xhigh",
    };
    const events = ["implementation", "standards", "spec"].flatMap(
      (axis, i) => {
        if (axis !== "implementation") {
          const record = {
            axis,
            agent_id: `${axis}-child`,
            requested_route: route,
            observed_route: route,
            route_bound: "true",
            provider_evidence: "current-host-environment-default",
          };
          for (const suffix of ["route", "observed-route"])
            writeFileSync(
              join(scope, `${axis}-${suffix}.json`),
              JSON.stringify(record),
            );
        }
        if (axis === "spec" && mutation === "missing reader") return [];
        const effort =
          axis === "spec" && mutation === "wrong route" ? "low" : "xhigh";
        return [
          host === "codex"
            ? {
                type: "darrow.codex_native_spawn",
                status: "accepted",
                agent_ref: `${axis}-child`,
                task_name:
                  axis === "implementation"
                    ? "issue_41_worker"
                    : `reader_${axis}`,
                review_axis: axis,
                model,
                reasoning_effort: effort,
                fork_turns: "none",
                message: "opaque encrypted assignment",
                accepted_ordinal: i + 1,
              }
            : {
                type: "darrow.review_agent_launch",
                agent_id: `${axis}-child`,
                review_axis: axis,
                subagent_type: `darrow-review:review-reader-${model}-${effort}`,
                batch: axis === "implementation" ? 0 : 1,
              },
        ];
      },
    );
    const seed = join(root, "events.json");
    writeFileSync(
      seed,
      JSON.stringify([
        ...events,
        { type: "darrow.codex_native_wait", ordinal: 4 },
      ]),
    );
    const view = join(root, "native");
    const builder =
      host === "codex" ? "native_fixture" : "native_claude_fixture";
    const operation = host === "codex" ? "retain_native" : "retain_claude";
    const prepared = spawnSync(
      "python3",
      [
        "-c",
        `import json,sys; from pathlib import Path; sys.path.insert(0,sys.argv[1]); from ${builder} import ${operation}; ${operation}(Path(sys.argv[2]),json.loads(Path(sys.argv[3]).read_text()))`,
        helpers,
        view,
        seed,
      ],
      { encoding: "utf8" },
    );
    assert.equal(prepared.status, 0, prepared.stderr);
    if (mutation === "unfinished reader") removeCompletion(view, host);
    const caseName =
      host === "codex"
        ? "isolated-ticket-serial.yaml"
        : "isolated-ticket-serial-claude.yaml";
    const fixture = parse(
      readFileSync(
        join(adaptive, "skills/adaptive-goal/evals", caseName),
        "utf8",
      ),
    ) as { checks: { name: string; run: string }[] };
    const check = fixture.checks.find(
      (item) =>
        item.name ===
        "comprehensive assessment uses completed independent standards and specification readers",
    );
    assert.ok(check);
    return spawnSync("/bin/bash", ["-c", check.run], {
      cwd: root,
      env: {
        ...process.env,
        SEVRO_CANDIDATE_ARTIFACT_REVIEWS: state,
        SEVRO_CANDIDATE_TRANSCRIPTS: view,
      },
      encoding: "utf8",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function removeCompletion(view: string, host: string) {
  const indexPath = join(view, "index.json");
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as {
    files: { path: string; sha256: string }[];
  };
  const entry = index.files.find((file) =>
    host === "codex"
      ? file.path === "child-2.jsonl"
      : file.path.endsWith("agent-spec-child.meta.json"),
  );
  assert.ok(entry);
  const path = join(view, host, entry.path);
  const original = readFileSync(path, "utf8");
  const changed =
    host === "codex"
      ? original
          .trim()
          .split("\n")
          .filter((line) => JSON.parse(line).payload?.type !== "task_complete")
          .join("\n") + "\n"
      : JSON.stringify({ ...JSON.parse(original), finished: false });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, changed);
  entry.sha256 = createHash("sha256").update(changed).digest("hex");
  writeFileSync(indexPath, JSON.stringify(index));
}

for (const host of ["codex", "claude"] as const) {
  for (const mutation of [
    "valid",
    "wrong route",
    "missing reader",
    "unfinished reader",
  ] as const) {
    test(`${host} isolated-reader oracle: ${mutation} with earlier encrypted worker`, () => {
      const result = runOracle(host, mutation);
      assert.equal(
        result.status,
        mutation === "valid" ? 0 : 1,
        result.stderr || result.stdout,
      );
    });
  }
}
