import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  nativePreOwnerSkillReads,
  nativeParentReadDiagnostics,
  retainedCodexEvidenceForThread,
} from "./codex";

const body =
  "---\nname: assess-implementation-readiness\ndescription: Readiness fixture\n---\n# Readiness\nRead every instruction.\nReturn the complete result.\n";
const spawn = [
  {
    ordinal: 10,
    payload: {
      type: "function_call",
      namespace: "collaboration",
      name: "spawn_agent",
      call_id: "owner-call",
      arguments: JSON.stringify({
        task_name: "worker",
        model: "gpt-5.6-terra",
        reasoning_effort: "medium",
        fork_turns: "none",
        message: "private",
      }),
    },
  },
  {
    ordinal: 11,
    payload: {
      type: "item_completed",
      item: {
        type: "SubAgentActivity",
        id: "owner-call",
        kind: "started",
        agent_thread_id: "child",
        agent_path: "/root/worker",
      },
    },
  },
  {
    ordinal: 12,
    payload: {
      type: "function_call_output",
      call_id: "owner-call",
      output: JSON.stringify({ task_name: "/root/worker" }),
    },
  },
];

test("pre-owner read evidence uses complete parent-local pages and native ordinals", async () => {
  const repo = await mkdtemp(join(tmpdir(), "darrow-pre-owner-read-"));
  try {
    const roots = join(repo, ".agents/skills");
    const skill = join(roots, "assess-implementation-readiness/SKILL.md");
    await mkdir(join(roots, "assess-implementation-readiness"), {
      recursive: true,
    });
    await writeFile(skill, body);
    const read = (
      ordinal: number,
      output: string,
      command: string | string[] = `cat ${skill}`,
    ) => ({
      ordinal,
      payload: {
        type: "item_completed",
        item: {
          type: "CommandExecution",
          command,
          aggregated_output: output,
          exit_code: 0,
          status: "completed",
        },
      },
    });
    const encode = (entries: unknown[]) =>
      entries.map((entry) => JSON.stringify(entry)).join("\n");
    const observe = (entries: unknown[]) =>
      nativePreOwnerSkillReads(encode(entries), repo, roots);
    const midpoint = body.indexOf("Read every");
    expect(observe([read(2, body), ...spawn])).toEqual([
      "assess-implementation-readiness",
    ]);
    const relativeRead = read(2, body, "cat SKILL.md");
    const relativeEvent = {
      ...relativeRead,
      payload: {
        ...relativeRead.payload,
        item: {
          ...relativeRead.payload.item,
          cwd: `file://${roots}/assess-implementation-readiness`,
          parsed_cmd: [{ type: "read", name: "SKILL.md", path: "SKILL.md" }],
        },
      },
    };
    const relativeSession = encode([relativeEvent, ...spawn]);
    expect(nativePreOwnerSkillReads(relativeSession, repo, roots)).toEqual([]);
    const diagnostics = nativeParentReadDiagnostics(
      relativeSession,
      repo,
      roots,
    );
    expect(diagnostics).toEqual([
      {
        type: "darrow.codex_native_read_diagnostic",
        actor: "parent",
        ordinal: 2,
        read_candidate: "assess-implementation-readiness",
        recognized_read: false,
        complete_body_in_output: true,
        frontmatter_in_output: true,
        finished_command: true,
        native_read_path_binds: true,
        clause_heads: ["cat"],
        clause_heads_truncated: false,
        mounted_root_mentioned: false,
        skill_filename_mentioned: true,
        cwd_is_skill_directory: true,
        diagnostics_truncated: false,
      },
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("SKILL.md");
    expect(JSON.stringify(diagnostics)).not.toContain("Read every instruction");
    expect(JSON.stringify(diagnostics)).not.toContain(repo);
    const bounded = nativeParentReadDiagnostics(
      encode([
        ...Array.from({ length: 30 }, (_, index) => read(index + 1, body)),
        ...spawn.map((entry) => ({ ...entry, ordinal: entry.ordinal + 100 })),
      ]),
      repo,
      roots,
    );
    expect(bounded).toHaveLength(24);
    expect(
      bounded.every((record) => record.diagnostics_truncated === true),
    ).toBe(true);
    expect(
      nativeParentReadDiagnostics(
        encode([...spawn, read(20, body)]),
        repo,
        roots,
      ),
    ).toEqual([]);
    const partial = nativeParentReadDiagnostics(
      encode([read(2, body.slice(0, body.indexOf("Read every"))), ...spawn]),
      repo,
      roots,
    );
    expect(partial[0]).toMatchObject({
      recognized_read: true,
      complete_body_in_output: false,
      frontmatter_in_output: true,
    });
    for (const command of [
      `/bin/zsh -c 'cat ${skill}'`,
      `/bin/bash -c 'cat ${skill}'`,
      ["/bin/zsh", "-c", `cat ${skill}`],
      ["/bin/bash", "-c", `cat ${skill}`],
      `if test -f ${skill}; then cat ${skill}; fi`,
      `if false; then printf absent; else cat ${skill}; fi`,
      `for f in ${roots}/*/SKILL.md; do cat "$f"; done`,
      `for f in ${roots}/*/SKILL.md; do if [ -f "$f" ]; then sed -n '1,240p' "$f"; fi; done`,
      `for f in ${roots}/*/SKILL.md; do if test -f "$f"; then printf '\\n--- %s ---\\n' "$f"; sed -n '1,240p' "$f"; fi; done`,
    ]) {
      expect(observe([read(2, body, command), ...spawn])).toEqual([
        "assess-implementation-readiness",
      ]);
      expect(observe([...spawn, read(20, body, command)])).toEqual([]);
      expect(
        observe([read(2, body.slice(0, midpoint), command), ...spawn]),
      ).toEqual([]);
    }
    expect(
      observe([read(2, body, `/bin/zsh -c 'echo ${skill}'`), ...spawn]),
    ).toEqual([]);
    expect(
      observe([
        read(
          2,
          body.slice(0, midpoint),
          `if test -f ${skill}; then head ${skill}; fi`,
        ),
        ...spawn,
      ]),
    ).toEqual([]);
    expect(observe([...spawn, read(2, body)])).toEqual([
      "assess-implementation-readiness",
    ]);
    expect(
      observe([
        read(2, body.slice(0, midpoint)),
        read(3, body.slice(midpoint)),
        ...spawn,
      ]),
    ).toEqual(["assess-implementation-readiness"]);
    expect(observe([...spawn, read(20, body)])).toEqual([]);
    expect(
      observe([
        read(2, body.slice(0, midpoint)),
        ...spawn,
        read(20, body.slice(midpoint)),
      ]),
    ).toEqual([]);
    expect(observe([read(2, body), ...spawn.slice(0, 2)])).toEqual([]);
    expect(observe([read(2, body), ...spawn, { bad: true }])).toEqual([]);

    // A correct preflight stop has no owner. Preserve diagnostic read facts,
    // without inventing the accepted boundary needed for pre-owner credit.
    expect(observe([read(2, body)])).toEqual([]);
    expect(
      nativeParentReadDiagnostics(encode([read(2, body)]), repo, roots),
    ).toEqual([
      expect.objectContaining({
        ordinal: 2,
        recognized_read: true,
        complete_body_in_output: true,
      }),
    ]);
    expect(
      nativeParentReadDiagnostics(
        encode([read(2, body.slice(0, midpoint))]),
        repo,
        roots,
      ),
    ).toEqual([expect.objectContaining({ complete_body_in_output: false })]);
    expect(
      nativeParentReadDiagnostics(
        encode([read(2, body), { bad: true }]),
        repo,
        roots,
      ),
    ).toEqual([]);

    const config = join(repo, "config");
    const sessions = join(config, "sessions");
    await mkdir(sessions, { recursive: true });
    const parentFile = join(sessions, "rollout-parent.jsonl");
    const childFile = join(sessions, "rollout-child.jsonl");
    const stream = JSON.stringify({
      type: "thread.started",
      thread_id: "parent",
    });
    await writeFile(parentFile, encode([read(2, body, `echo ${skill}`)]));
    const stopped = await retainedCodexEvidenceForThread(stream, repo, config, {
      installedSkillsRoot: roots,
    });
    expect(stopped).toContain('"type":"darrow.codex_native_read_diagnostic"');
    expect(stopped).toContain('"recognized_read":false');
    expect(stopped).not.toContain('"type":"darrow.skill_read_probe"');
    expect(stopped).not.toContain("darrow.codex_native_pre_owner_skill_read");
    expect(stopped).not.toContain("Read every instruction");
    expect(stopped).not.toContain(repo);
    await writeFile(parentFile, encode(spawn));
    await writeFile(childFile, encode([read(1, body)]));
    const childOnly = await retainedCodexEvidenceForThread(
      stream,
      repo,
      config,
      { installedSkillsRoot: roots },
    );
    expect(childOnly).toContain('"type":"darrow.skill_read_probe"');
    expect(childOnly).not.toContain("darrow.codex_native_pre_owner_skill_read");
    expect(childOnly).toContain('"actor":"accepted_child"');
    expect(childOnly).toContain('"session_status":"available"');
    expect(childOnly).toContain('"complete_body_in_output":true');
    expect(childOnly).not.toContain("Read every instruction");
    expect(childOnly).not.toContain(repo);

    const childRecords = async () =>
      (
        await retainedCodexEvidenceForThread(stream, repo, config, {
          installedSkillsRoot: roots,
        })
      )
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    for (const [childEntries, status, count] of [
      [[{ bad: true }], "malformed", null],
      [[], "available", 0],
      [[read(1, body.slice(0, midpoint))], "available", 1],
      [[read(1, body, "cat SKILL.md")], "available", 1],
    ] as const) {
      await writeFile(childFile, encode([...childEntries]));
      const records = await childRecords();
      expect(records).toContainEqual(
        expect.objectContaining({
          type: "darrow.codex_native_child_skill_evidence",
          actor: "accepted_child",
          child_thread_id: "child",
          session_status: status,
          command_execution_count: count,
          children_truncated: false,
          diagnostics_truncated: false,
        }),
      );
      expect(
        records.some((record) => record.type === "darrow.skill_read_probe"),
      ).toBe(false);
    }
    await rm(childFile);
    expect(await childRecords()).toContainEqual(
      expect.objectContaining({
        type: "darrow.codex_native_child_skill_evidence",
        session_status: "unavailable",
        command_execution_count: null,
        read_diagnostic_count: null,
      }),
    );
    await writeFile(
      childFile,
      encode(Array.from({ length: 30 }, (_, index) => read(index, body))),
    );
    const capped = (await childRecords()).filter(
      (record) => record.type === "darrow.codex_native_read_diagnostic",
    );
    expect(capped).toHaveLength(24);
    expect(
      capped.every(
        (record) =>
          record.actor === "accepted_child" && record.diagnostics_truncated,
      ),
    ).toBe(true);
    await writeFile(childFile, encode([read(1, body)]));
    await writeFile(parentFile, encode([read(2, body), ...spawn]));
    const parent = await retainedCodexEvidenceForThread(stream, repo, config, {
      installedSkillsRoot: roots,
    });
    expect(parent).toContain(
      '"type":"darrow.codex_native_pre_owner_skill_read","actor":"parent","pre_owner_skill":"assess-implementation-readiness","status":"completed"',
    );
    expect(parent).not.toContain("Read every instruction");
    const initialRead = {
      type: "item.completed",
      item: {
        type: "command_execution",
        command: `cat ${skill}`,
        aggregated_output: body,
        exit_code: 0,
        status: "completed",
      },
    };
    const followUpStream = [
      stream,
      JSON.stringify(initialRead),
      JSON.stringify({
        type: "darrow.eval.follow_up_turn",
        thread_id: "parent",
        native_after_ordinal: 5,
      }),
    ].join("\n");
    const followUp = await retainedCodexEvidenceForThread(
      followUpStream,
      repo,
      config,
      { installedSkillsRoot: roots },
    );
    expect(followUp).toContain(
      '"pre_owner_skill":"assess-implementation-readiness"',
    );
    expect(followUp).not.toMatch(
      /"type":"darrow.eval.follow_up_turn"[\s\S]*"skill":"assess-implementation-readiness"/,
    );
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("child read diagnostics are bounded and require accepted children", async () => {
  const repo = await mkdtemp(join(tmpdir(), "darrow-child-read-diagnostics-"));
  try {
    const config = join(repo, "config");
    const sessions = join(config, "sessions");
    await mkdir(sessions, { recursive: true });
    const parentFile = join(sessions, "rollout-parent.jsonl");
    const stream = JSON.stringify({
      type: "thread.started",
      thread_id: "parent",
    });
    const entries = Array.from({ length: 9 }, (_, childIndex) =>
      spawn.map((entry) => {
        const copy = JSON.parse(
          JSON.stringify(entry)
            .replaceAll("owner-call", `owner-call-${childIndex}`)
            .replaceAll("worker", `worker_${childIndex}`)
            .replaceAll('"child"', `"child-${childIndex}"`),
        );
        copy.ordinal += childIndex * 10;
        return copy;
      }),
    ).flat();
    const encode = (items: unknown[]) =>
      items.map((item) => JSON.stringify(item)).join("\n");
    await writeFile(parentFile, encode(entries));
    const retained = await retainedCodexEvidenceForThread(stream, repo, config);
    const children = retained
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter(
        (record) => record.type === "darrow.codex_native_child_skill_evidence",
      );
    expect(children).toHaveLength(8);
    expect(
      children.every(
        (record) =>
          record.children_truncated === true &&
          record.session_status === "unavailable",
      ),
    ).toBe(true);
    expect(retained).not.toContain("private");
    expect(retained).not.toContain(repo);
    await writeFile(parentFile, encode(spawn.slice(0, 2)));
    const unaccepted = await retainedCodexEvidenceForThread(
      stream,
      repo,
      config,
    );
    expect(unaccepted).not.toContain(
      "darrow.codex_native_child_skill_evidence",
    );
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
