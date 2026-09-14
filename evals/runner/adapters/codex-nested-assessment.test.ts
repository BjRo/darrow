import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { retainedCodexEvidenceForThread } from "./codex";

function launch(
  id: string,
  path: string,
  forkTurns = "none",
  taskName = "assessment",
) {
  return [
    {
      ordinal: 1,
      payload: {
        type: "function_call",
        namespace: "collaboration",
        name: "spawn_agent",
        call_id: id,
        arguments: JSON.stringify({
          task_name: taskName,
          fork_turns: forkTurns,
          message: "PRIVATE PROMPT",
        }),
      },
    },
    {
      ordinal: 2,
      payload: {
        type: "item_completed",
        item: {
          type: "SubAgentActivity",
          id,
          kind: "started",
          agent_thread_id: id,
          agent_path: path,
        },
      },
    },
    {
      ordinal: 3,
      payload: {
        type: "function_call_output",
        call_id: id,
        output: JSON.stringify({ task_name: path }),
      },
    },
  ];
}

const encode = (entries: unknown[]) =>
  entries.map((entry) => JSON.stringify(entry)).join("\n");

function completedReader(turn = "turn-1", text = "PRIVATE READER RESULT") {
  return [
    {
      ordinal: 1,
      payload: {
        type: "item_completed",
        turn_id: turn,
        item: {
          type: "AgentMessage",
          phase: "final_answer",
          content: [{ type: "Text", text }],
        },
      },
    },
    {
      ordinal: 2,
      payload: {
        type: "task_complete",
        turn_id: turn,
        last_agent_message: text,
      },
    },
  ];
}

test("nested assessment evidence binds fresh accepted reader sessions without leaking contents", async () => {
  const repo = await mkdtemp(join(tmpdir(), "darrow-nested-assessment-"));
  try {
    const config = join(repo, "config");
    const sessions = join(config, "sessions");
    await mkdir(sessions, { recursive: true });
    const parent = join(sessions, "rollout-parent.jsonl");
    const child = join(sessions, "rollout-provider.jsonl");
    const reader = join(sessions, "rollout-reader.jsonl");
    await writeFile(parent, encode(launch("provider", "/root/provider")));
    await writeFile(child, encode(launch("reader", "/root/provider/reader")));
    await writeFile(
      reader,
      encode([
        {
          ordinal: 1,
          payload: { type: "private", contents: "PRIVATE READER CONTENT" },
        },
      ]),
    );
    const observe = async () => {
      const raw = await retainedCodexEvidenceForThread(
        JSON.stringify({ type: "thread.started", thread_id: "parent" }),
        repo,
        config,
      );
      expect(raw).not.toContain("PRIVATE");
      expect(raw).not.toContain(repo);
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((record) => record.type === "darrow.codex_native_nested_spawn");
    };
    expect(await observe()).toEqual([
      expect.objectContaining({
        parent_child_thread_id: "provider",
        child_thread_id: "reader",
        fork_turns: "none",
        status: "accepted",
        session_status: "available",
        reader_result_status: "unavailable",
      }),
    ]);
    await writeFile(
      child,
      encode(
        launch("reader", "/root/provider/reader", "none", "acceptance_spec"),
      ),
    );
    await writeFile(reader, encode(completedReader()));
    expect(await observe()).toEqual([
      expect.objectContaining({
        task_name: "acceptance_spec",
        review_axis: "spec",
        reader_result_status: "completed",
      }),
    ]);
    await writeFile(
      child,
      encode(launch("reader", "/root/provider/reader", "none", "unrelated")),
    );
    expect((await observe())[0]).not.toHaveProperty("review_axis");
    for (const invalid of [
      completedReader().slice(0, 1),
      completedReader().slice(1),
      [completedReader()[0], completedReader("different")[1]],
      [completedReader()[0], completedReader("turn-1", "different")[1]],
      completedReader("turn-1", ""),
      [...completedReader(), completedReader()[1]],
      [
        ...completedReader(),
        { ordinal: 3, payload: { type: "turn_aborted", turn_id: "turn-1" } },
      ],
    ]) {
      await writeFile(reader, encode(invalid));
      expect((await observe())[0]).toHaveProperty(
        "reader_result_status",
        "unavailable",
      );
    }
    await writeFile(
      child,
      encode(launch("reader", "/root/provider/reader", "all")),
    );
    expect(await observe()).toEqual([
      expect.objectContaining({ fork_turns: "all", status: "accepted" }),
    ]);
    await rm(reader);
    expect(await observe()).toEqual([
      expect.objectContaining({
        status: "accepted",
        session_status: "unavailable",
      }),
    ]);
    await writeFile(reader, "not-json\n");
    expect(await observe()).toEqual([
      expect.objectContaining({ session_status: "malformed" }),
    ]);
    await writeFile(
      child,
      encode(launch("reader", "/root/provider/reader").slice(0, 2)),
    );
    expect(await observe()).toEqual([
      expect.objectContaining({
        status: "unaccepted",
        session_status: "unavailable",
      }),
    ]);
    await writeFile(
      child,
      encode(
        Array.from({ length: 9 }, (_, index) =>
          launch(`reader-${index}`, `/root/provider/reader_${index}`).map(
            (entry) => ({ ...entry, ordinal: entry.ordinal + index * 3 }),
          ),
        ).flat(),
      ),
    );
    const capped = await observe();
    expect(capped).toHaveLength(8);
    expect(capped.every((record) => record.requests_truncated === true)).toBe(
      true,
    );
    await writeFile(child, "malformed\n");
    expect(await observe()).toEqual([]);
    await writeFile(child, encode(launch("reader", "/root/provider/reader")));
    await writeFile(
      parent,
      encode(launch("provider", "/root/provider").slice(0, 2)),
    );
    expect(await observe()).toEqual([]);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("verification cases require the applicable axes and completed reader results", async () => {
  const record = (axis: string, result = "completed") =>
    JSON.stringify({
      type: "darrow.codex_native_nested_spawn",
      status: "accepted",
      review_axis: axis,
      fork_turns: "none",
      session_status: "available",
      reader_result_status: result,
      children_truncated: false,
      requests_truncated: false,
    });
  for (const name of [
    "replacement",
    "followup-clear",
    "followup-progress",
    "followup-no-progress",
    "followup-regression",
  ]) {
    const source = await readFile(
      join(
        import.meta.dir,
        "../../..",
        "plugins/capability/darrow-verification/skills/verify-change/evals",
        `${name}.yaml`,
      ),
      "utf8",
    );
    const definition = parse(source) as {
      transcript_checks: { name: string; expect_regex: string }[];
    };
    const check = definition.transcript_checks.find(
      (check) => check.name === "provider and independent readers observed",
    )!;
    const regex = new RegExp(check.expect_regex);
    expect(regex.test(record("standards") + "\n" + record("spec"))).toBe(true);
    expect(regex.test(record("spec") + "\n" + record("standards"))).toBe(true);
    expect(regex.test(record("unrelated") + "\n" + record("unrelated"))).toBe(
      false,
    );
    expect(
      regex.test(
        record("standards", "unavailable") +
          "\n" +
          record("spec", "unavailable"),
      ),
    ).toBe(false);
    expect(regex.test(record("standards") + "\n" + record("standards"))).toBe(
      false,
    );
    if (name === "replacement")
      expect(regex.test(record("spec") + "\n" + record("spec"))).toBe(false);
  }
});
