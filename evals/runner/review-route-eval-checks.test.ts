import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { EvalCase } from "./types";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const cases = [
  {
    file: "reviewer-route-override",
    check: "both isolated axes retain exact route application evidence",
    claude: ["claude-sonnet-5", "high"],
    codex: ["gpt-5.5", "xhigh"],
  },
  {
    file: "fix-verification-resolved",
    check: "both fix verifiers retain exact default route evidence",
    claude: ["claude-opus-5", "xhigh"],
    codex: ["gpt-6-sol", "xhigh"],
  },
] as const;
type Mutation =
  | "valid"
  | "reused child"
  | "swapped launch IDs"
  | "missing launch"
  | "extra launch"
  | "separate batches";

function launchEvent({
  host,
  model,
  effort,
  axis,
  index,
  id,
  mutation,
}: {
  host: "claude" | "codex";
  model: string;
  effort: string;
  axis: string;
  index: number;
  id: string;
  mutation: Mutation;
}) {
  const launchId =
    mutation === "swapped launch IDs"
      ? `${axis === "spec" ? "standards" : "spec"}-child`
      : id;
  if (host === "claude") {
    return {
      type: "darrow.review_agent_launch",
      agent_id: launchId,
      review_axis: axis,
      subagent_type: `darrow-review:review-reader-${model}-${effort}`,
      batch: mutation === "separate batches" ? index : 0,
    };
  }
  return {
    type: "darrow.codex_native_spawn",
    status: "accepted",
    agent_ref: launchId,
    review_axis: axis,
    model,
    reasoning_effort: effort,
    fork_turns: "none",
    accepted_ordinal:
      mutation === "separate batches" && index === 1 ? 4 : index + 1,
  };
}

async function copyOracle(root: string) {
  const backend = resolve(
    import.meta.dir,
    "../../plugins/capability/darrow-review/backend",
  );
  const copied = join(root, ".git/eval-checks/review");
  await mkdir(join(copied, "tests", "evals"), { recursive: true });
  for (const name of [
    "src",
    "pyproject.toml",
    "uv.lock",
    "tests/evals/eval_routes.py",
  ]) {
    await cp(join(backend, name), join(copied, name), { recursive: true });
  }
}

async function runGate(
  entry: (typeof cases)[number],
  host: "claude" | "codex",
  mutation: Mutation,
) {
  const root = await mkdtemp(join(tmpdir(), "darrow-review-gate-"));
  roots.push(root);
  const artifacts = join(root, ".git", "darrow-review.fixture");
  await mkdir(artifacts, { recursive: true });
  await copyOracle(root);
  const [model, effort] = entry[host];
  const route = {
    host,
    provider: host === "claude" ? "anthropic" : "openai",
    model,
    effort,
  };
  await writeFile(
    join(artifacts, "reviewer-route.json"),
    JSON.stringify({ selected_route: route }),
  );
  const launches: Record<string, unknown>[] = [];
  const calls: Record<string, unknown>[] = [];
  for (const [index, axis] of ["standards", "spec"].entries()) {
    const id = mutation === "reused child" ? "shared-child" : `${axis}-child`;
    const record = JSON.stringify({
      axis,
      agent_id: id,
      observed_route: route,
      requested_route: route,
      route_bound: "true",
      provider_evidence: "current-host-environment-default",
    });
    await writeFile(join(artifacts, `${axis}-route.json`), record);
    await writeFile(join(artifacts, `${axis}-observed-route.json`), record);
    const subagent = `darrow-review:review-reader-${model}-${effort}`;
    calls.push({
      name: "Agent",
      input: { subagent_type: subagent, prompt: `- review_axis: ${axis}` },
    });
    if (mutation === "missing launch" && axis === "standards") continue;
    launches.push(
      launchEvent({ host, model, effort, axis, index, id, mutation }),
    );
  }
  if (mutation === "extra launch")
    launches.push({ ...launches[0], agent_id: "extra", agent_ref: "extra" });
  const transcript =
    host === "claude"
      ? [{ type: "assistant", message: { content: calls } }, ...launches]
      : [...launches, { type: "darrow.codex_native_wait", ordinal: 3 }];
  await writeFile(
    join(root, ".git", "retained-harness.jsonl"),
    transcript.map((event) => JSON.stringify(event)).join("\n") + "\n",
  );
  const evalCase = parseYaml(
    await readFile(
      resolve(
        import.meta.dir,
        "../../plugins/capability/darrow-review/skills/code-review/evals",
        `${entry.file}.yaml`,
      ),
      "utf8",
    ),
  ) as EvalCase;
  const check = evalCase.checks.find((check) => check.name === entry.check);
  if (!check?.run) throw new Error(`missing gate: ${entry.check}`);
  return spawnSync("/bin/bash", ["-c", check.run], {
    cwd: root,
    env: {
      ...process.env,
      DARROW_EVAL_HARNESS: host,
      DARROW_REVIEW_STATE_DIR: join(root, ".git"),
    },
    encoding: "utf8",
  });
}

describe("reviewer route eval identity gates", () => {
  for (const entry of cases) {
    for (const host of ["claude", "codex"] as const) {
      test(`${entry.file} accepts distinct ${host} readers`, async () => {
        const result = await runGate(entry, host, "valid");
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(0);
      });
      for (const mutation of [
        "reused child",
        "swapped launch IDs",
        "missing launch",
        "extra launch",
        "separate batches",
      ] as const) {
        test(`${entry.file} rejects ${host} ${mutation}`, async () => {
          const result = await runGate(entry, host, mutation);
          expect(result.error).toBeUndefined();
          expect(result.status).toBe(1);
        });
      }
    }
  }
});
