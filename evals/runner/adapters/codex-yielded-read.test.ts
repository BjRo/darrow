import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexHarnessActivationEvidence } from "./codex";

const body =
  "---\nname: code-review\ndescription: Review changes\n---\n# Review\nRead the complete instructions and launch an independent reader.\n";
type Entry = { ordinal: number; payload: Record<string, unknown> };

function chunk(output = body, process = 54171): Entry {
  return {
    ordinal: 15,
    payload: {
      type: "custom_tool_call_output",
      call_id: "read-call",
      output: [
        {
          type: "input_text",
          text: "Script completed\nWall time 1.2 seconds\nOutput:\n",
        },
        {
          type: "input_text",
          text: JSON.stringify({
            chunk_id: "53f3a6",
            wall_time_seconds: 1.001,
            session_id: process,
            output,
          }),
        },
      ],
    },
  };
}

async function fixture() {
  const repo = await mkdtemp(join(tmpdir(), "darrow-yielded-read-"));
  const skills = join(repo, ".agents/skills");
  const config = join(repo, ".git/codex");
  await mkdir(join(skills, "code-review"), { recursive: true });
  await mkdir(join(config, "sessions"), { recursive: true });
  await writeFile(join(skills, "code-review/SKILL.md"), body);
  const call: Entry = {
    ordinal: 13,
    payload: {
      type: "custom_tool_call",
      name: "exec",
      namespace: "functions",
      call_id: "read-call",
      input: "encrypted-private-input",
    },
  };
  const complete: Entry = {
    ordinal: 20,
    payload: {
      type: "item_completed",
      item: {
        type: "CommandExecution",
        id: "exec-read",
        process_id: "54171",
        command: [
          "/bin/zsh",
          "-lc",
          `cat ${skills}/code-review/SKILL.md; sleep 3; printf 'READ_COMPLETE\\n'`,
        ],
        source: "unified_exec_startup",
        status: "completed",
        exit_code: 0,
        aggregated_output: "READ_COMPLETE\n",
      },
    },
  };
  const run = async (entries: Entry[]) => {
    await writeFile(
      join(config, "sessions/rollout-parent.jsonl"),
      entries.map((entry) => JSON.stringify(entry)).join("\n"),
    );
    return codexHarnessActivationEvidence(
      {
        repoDir: repo,
        prompt: "Review my changes",
        model: "gpt-6-luna",
        effort: "medium",
      },
      {
        canonicalRepoDir: repo,
        configRoot: config,
        installedSkillsRoots: [skills],
        out: '{"type":"thread.started","thread_id":"parent"}\n{"type":"turn.completed"}',
        err: "",
        code: 0,
        durationMs: 0,
      },
    );
  };
  return {
    repo,
    call,
    complete,
    run,
    cleanup: () => rm(repo, { recursive: true, force: true }),
  };
}

test("a yielded mounted read counts its model-visible early output and retains only recovery facts", async () => {
  const f = await fixture();
  try {
    const result = await f.run([f.call, chunk(), f.complete]);
    expect(result.activation.complete).toBeTrue();
    expect(result.activation.observedSkills).toEqual(["code-review"]);
    const diagnostics = result.raw
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter(
        (record) => record.type === "darrow.codex_native_read_diagnostic",
      );
    expect(diagnostics[0]).toMatchObject({
      complete_body_in_output: false,
      yielded_output_chunks: 1,
      complete_body_after_yield_recovery: true,
    });
    expect(result.raw).not.toContain(body);
    expect(result.raw).not.toContain("encrypted-private-input");
    expect(result.raw).not.toContain(f.repo);
  } finally {
    await f.cleanup();
  }
});

test("plain early output binds an awaited literal command to its later native completion", async () => {
  const f = await fixture();
  try {
    const item = f.complete.payload.item as { command: string[] };
    const code = `const result = await tools.exec_command({cmd: ${JSON.stringify(item.command[2])}, yield_time_ms: 1000});\nstore("read-session", result.session_id);\ntext(result.output);`;
    const call = { ...f.call, payload: { ...f.call.payload, input: code } };
    const returned = plainOutput();
    const result = await f.run([call, returned, f.complete]);
    expect(result.activation.observedSkills).toEqual(["code-review"]);
    expect(result.raw).toContain('"literal_command_output_recovered":true');
    expect(result.raw).not.toContain(code);
    expect(result.raw).not.toContain(body);
    expect(result.raw).not.toContain(f.repo);
  } finally {
    await f.cleanup();
  }
});

function plainOutput(output = body): Entry {
  const result = chunk();
  result.payload.output = [
    {
      type: "input_text",
      text: "Script completed\nWall time 1.2 seconds\nOutput:\n",
    },
    { type: "input_text", text: output },
  ];
  return result;
}

test("plain early output rejects conditional, dynamic, altered and ambiguous command bindings", async () => {
  const f = await fixture();
  try {
    const item = f.complete.payload.item as { command: string[] };
    const cmd = JSON.stringify(item.command[2]);
    const first = `const result = await tools.exec_command({cmd: ${cmd}});`;
    const code = `${first} text(result.output);`;
    const variants = [
      `if (true) { ${code} }`,
      `function unused() { ${code} }`,
      code.replace("await ", ""),
      `${first} text("unrelated output");`,
      `${first} result.output = "changed"; text(result.output);`,
      `${first} text(result.stderr);`,
      code.replace(cmd, "commandFromElsewhere"),
      code.replace(cmd, '"printf unrelated"'),
      code.replace("{cmd:", '{workdir: "/unrelated", cmd:'),
      code.replace("{cmd:", '{cmd: "other", cmd:'),
      `${code} ${first.replace("result", "other")}`,
      `/* ${code} */`,
      `${code} }`,
      "encrypted-private-input",
    ];
    for (const input of variants) {
      const call = { ...f.call, payload: { ...f.call.payload, input } };
      expect(
        (await f.run([call, plainOutput(), f.complete])).activation
          .observedSkills,
      ).toEqual([]);
    }
    const call = { ...f.call, payload: { ...f.call.payload, input: code } };
    for (const entries of [
      [call, plainOutput()],
      [call, plainOutput(), f.complete, { ...f.complete, ordinal: 30 }],
      [call, plainOutput(), { ...plainOutput(), ordinal: 16 }, f.complete],
      [call, { ...call, ordinal: 14 }, plainOutput(), f.complete],
    ])
      expect((await f.run(entries)).activation.observedSkills).toEqual([]);
  } finally {
    await f.cleanup();
  }
});

test("literal command recovery binds an explicit working directory and preserves later process chunks", async () => {
  const f = await fixture();
  try {
    const item = f.complete.payload.item as { command: string[] };
    const input = `const result = await tools.exec_command({cmd: ${JSON.stringify(item.command[2])}, workdir: ${JSON.stringify(f.repo)}}); text(result.output);`;
    const call = { ...f.call, payload: { ...f.call.payload, input } };
    const complete = {
      ...f.complete,
      ordinal: 30,
      payload: {
        ...f.complete.payload,
        item: { ...item, cwd: new URL(`file://${f.repo}`).href },
      },
    };
    const midpoint = body.indexOf("# Review");
    const poll = {
      ordinal: 20,
      payload: {
        type: "custom_tool_call",
        name: "exec",
        call_id: "poll-call",
        input: "private poll",
      },
    };
    const remainder = chunk(body.slice(midpoint));
    remainder.ordinal = 22;
    remainder.payload.call_id = "poll-call";
    const result = await f.run([
      call,
      plainOutput(body.slice(0, midpoint)),
      poll,
      remainder,
      complete,
    ]);
    expect(result.activation.observedSkills).toEqual(["code-review"]);
    expect(result.raw).toContain('"earlier_output_chunks":1');
    expect(result.raw).toContain('"literal_command_output_recovered":true');
  } finally {
    await f.cleanup();
  }
});

test("unbound, late, partial and ambiguous yielded output cannot establish activation", async () => {
  const f = await fixture();
  try {
    const missingCall = [chunk(), f.complete];
    const unrelatedCall = {
      ...f.call,
      payload: { ...f.call.payload, name: "unrelated_tool" },
    };
    const incomplete = {
      ...f.complete,
      payload: {
        ...f.complete.payload,
        item: { ...(f.complete.payload.item as object), status: "in_progress" },
      },
    };
    const unrecognized = {
      ...f.complete,
      payload: {
        ...f.complete.payload,
        item: {
          ...(f.complete.payload.item as object),
          command: "printf irrelevant",
        },
      },
    };
    for (const entries of [
      missingCall,
      [unrelatedCall, chunk(), f.complete],
      [f.call, chunk(body, 999), f.complete],
      [f.call, chunk(body.slice(0, 70)), f.complete],
      [f.call, chunk(), incomplete],
      [f.call, chunk(), unrecognized],
      [f.call, f.complete, { ...chunk(), ordinal: 22 }],
      [f.call, chunk(), f.complete, { ...f.complete, ordinal: 30 }],
      [f.call, chunk()],
    ])
      expect((await f.run(entries)).activation.observedSkills).toEqual([]);
  } finally {
    await f.cleanup();
  }
});

test("yielded chunks cannot cross actors or combine across different process identifiers", async () => {
  const f = await fixture();
  try {
    const midpoint = body.indexOf("# Review");
    expect(
      (
        await f.run([
          f.call,
          chunk(body.slice(0, midpoint)),
          { ...chunk(body.slice(midpoint), 999), ordinal: 17 },
          f.complete,
        ])
      ).activation.observedSkills,
    ).toEqual([]);
    // An unrelated child's result is not available to the parent read probe.
    await mkdir(join(f.repo, ".git/codex/sessions/child"), { recursive: true });
    await writeFile(
      join(f.repo, ".git/codex/sessions/child/rollout-unrelated.jsonl"),
      [f.call, chunk()].map((entry) => JSON.stringify(entry)).join("\n"),
    );
    expect((await f.run([f.complete])).activation.observedSkills).toEqual([]);
  } finally {
    await f.cleanup();
  }
});

function completedOutput(output = body): Entry {
  return {
    ordinal: 21,
    payload: {
      type: "custom_tool_call_output",
      call_id: "read-call",
      output: JSON.stringify([
        {
          type: "input_text",
          text: "Script completed\nWall time 0.2 seconds\nOutput:\n",
        },
        { type: "input_text", text: output },
      ]),
    },
  };
}

test("a complete executor result recovers an empty sole-command completion", async () => {
  const f = await fixture();
  try {
    const complete = {
      ...f.complete,
      payload: {
        ...f.complete.payload,
        item: { ...(f.complete.payload.item as object), aggregated_output: "" },
      },
    };
    const result = await f.run([f.call, complete, completedOutput()]);
    expect(result.activation.observedSkills).toEqual(["code-review"]);
    expect(result.raw).toContain('"completed_call_output_recovered":true');
    expect(result.raw).toContain('"complete_body_in_output":false');
    expect(result.raw).not.toContain(body);
    expect(result.raw).not.toContain("encrypted-private-input");
    expect(result.raw).not.toContain(f.repo);
  } finally {
    await f.cleanup();
  }
});

test("completed executor output requires a unique matching call and sole native command", async () => {
  const f = await fixture();
  try {
    const complete = {
      ...f.complete,
      payload: {
        ...f.complete.payload,
        item: { ...(f.complete.payload.item as object), aggregated_output: "" },
      },
    };
    const another = {
      ...complete,
      ordinal: 19,
      payload: {
        ...complete.payload,
        item: {
          ...(complete.payload.item as object),
          id: "another",
          process_id: "222",
          command: "printf unrelated",
        },
      },
    };
    for (const entries of [
      [complete, completedOutput()],
      [
        f.call,
        complete,
        {
          ...completedOutput(),
          payload: { ...completedOutput().payload, call_id: "wrong-call" },
        },
      ],
      [f.call, another, complete, completedOutput()],
      [f.call, { ...f.call, ordinal: 17 }, complete, completedOutput()],
      [
        f.call,
        {
          ...f.call,
          ordinal: 17,
          payload: { ...f.call.payload, call_id: "other-call" },
        },
        complete,
        completedOutput(),
      ],
      [f.call, complete, completedOutput(body.slice(0, 70))],
      [f.call, completedOutput(), { ...complete, ordinal: 22 }],
      [
        complete,
        { ...f.call, ordinal: 21 },
        { ...completedOutput(), ordinal: 22 },
      ],
      [
        f.call,
        complete,
        completedOutput(),
        { ...completedOutput(), ordinal: 23 },
      ],
      [
        { ...f.call, payload: { ...f.call.payload, name: "unrelated_tool" } },
        complete,
        completedOutput(),
      ],
      [
        f.call,
        {
          ...complete,
          payload: {
            ...complete.payload,
            item: {
              ...(complete.payload.item as object),
              command: "printf unrelated",
            },
          },
        },
        completedOutput(),
      ],
      [
        f.call,
        complete,
        {
          ...completedOutput(),
          payload: {
            ...completedOutput().payload,
            output: { arbitrary: body },
          },
        },
      ],
      [
        f.call,
        complete,
        { ...completedOutput(), ordinal: 22 },
        { ...complete, ordinal: 25 },
      ],
      [
        f.call,
        {
          ...complete,
          payload: {
            ...complete.payload,
            item: {
              ...(complete.payload.item as object),
              status: "in_progress",
            },
          },
        },
        completedOutput(),
      ],
      [
        f.call,
        {
          ...complete,
          payload: {
            ...complete.payload,
            item: {
              ...(complete.payload.item as object),
              source: "unrelated_source",
            },
          },
        },
        completedOutput(),
      ],
      [
        f.call,
        complete,
        {
          ...completedOutput(),
          payload: {
            ...completedOutput().payload,
            output: [{ type: "input_text", text: body }],
          },
        },
      ],
    ])
      expect((await f.run(entries)).activation.observedSkills).toEqual([]);
  } finally {
    await f.cleanup();
  }
});

test("completed output from another actor cannot fill a parent's empty command", async () => {
  const f = await fixture();
  try {
    await mkdir(join(f.repo, ".git/codex/sessions/child"), { recursive: true });
    await writeFile(
      join(f.repo, ".git/codex/sessions/child/rollout-unrelated.jsonl"),
      JSON.stringify(completedOutput()) + "\n",
    );
    const complete = {
      ...f.complete,
      payload: {
        ...f.complete.payload,
        item: { ...(f.complete.payload.item as object), aggregated_output: "" },
      },
    };
    expect((await f.run([f.call, complete])).activation.observedSkills).toEqual(
      [],
    );
  } finally {
    await f.cleanup();
  }
});
