import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  codexExplicitSkillActivation,
  codexHarnessActivationEvidence,
  retainedCodexEvidence,
} from "./codex";

const body = [
  "---",
  "name: adaptive-delivery",
  "description: Paginated source fixture.",
  "---",
  "# Fixture",
  "First distinct instruction.",
  "Second distinct instruction.",
  "Third distinct instruction.",
  "Fourth distinct instruction.",
  "Final distinct instruction.",
  "",
].join("\n");
const midpoint = body.indexOf("Second distinct");
const overlap = body.indexOf("First distinct");

test("an explicit owner's later file reread cannot conflict with its earlier dispatch", async () => {
  const repo = await mkdtemp(join(tmpdir(), "darrow-owner-reread-"));
  try {
    const skills = join(repo, ".agents/skills");
    const config = join(repo, ".git/codex");
    await mkdir(join(config, "sessions"), { recursive: true });
    const names = ["adaptive-delivery", "ticket-to-pr", "create-pr"];
    const bodies = new Map(
      names.map((name) => [
        name,
        `---\nname: ${name}\ndescription: Test skill\n---\nComplete body.\n`,
      ]),
    );
    for (const name of names) {
      await mkdir(join(skills, name), { recursive: true });
      await writeFile(join(skills, name, "SKILL.md"), bodies.get(name)!);
    }
    const item = (name: string) => ({
      type: "command_execution",
      command: `cat ${skills}/${name}/SKILL.md`,
      aggregated_output: bodies.get(name),
      exit_code: 0,
      status: "completed",
    });
    const native = (order: string[]) =>
      writeFile(
        join(config, "sessions/rollout-parent.jsonl"),
        order
          .map((name, ordinal) =>
            JSON.stringify({
              ordinal,
              payload: {
                type: "item_completed",
                item: { ...item(name), type: "CommandExecution" },
              },
            }),
          )
          .join("\n"),
      );
    const out = [
      { type: "thread.started", thread_id: "parent" },
      ...names.map((name) => ({ type: "item.completed", item: item(name) })),
      { type: "turn.completed" },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");
    const run = (explicit: boolean, prompt = "$ticket-to-pr") =>
      codexHarnessActivationEvidence(
        {
          repoDir: repo,
          prompt,
          model: "gpt-5.6-terra",
          effort: "medium",
          control: explicit
            ? {
                activationProbe: {
                  mode: "explicit",
                  skill: "ticket-to-pr",
                  invocation: "$ticket-to-pr",
                },
              }
            : undefined,
        },
        {
          canonicalRepoDir: repo,
          configRoot: config,
          installedSkillsRoots: [skills],
          out,
          err: "",
          code: 0,
          durationMs: 0,
        },
      );
    await native(names);
    const explicit = await run(true);
    expect(explicit.activation.complete).toBeTrue();
    expect(explicit.activation.observedSkills).toEqual([
      "ticket-to-pr",
      "adaptive-delivery",
      "create-pr",
    ]);
    const implicit = await run(false);
    expect(implicit.activation.complete).toBeTrue();
    expect(implicit.activation.observedSkills).toEqual(names);
    expect(
      (await run(true, "$ticket-to-pr $ticket-to-pr")).activation.complete,
    ).toBeFalse();
    await native(["create-pr", "adaptive-delivery", "ticket-to-pr"]);
    expect((await run(true)).activation.complete).toBeFalse();
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

async function observe(pages: string[]) {
  const repo = await mkdtemp(join(tmpdir(), "darrow-skill-pages-"));
  try {
    const skills = join(repo, ".agents/skills");
    const skill = join(skills, "adaptive-delivery");
    await mkdir(skill, { recursive: true });
    await writeFile(join(skill, "SKILL.md"), body);
    const stream = [
      ...pages.map((page) =>
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "command_execution",
            command: `sed -n '1,240p' ${skill}/SKILL.md`,
            aggregated_output: page,
            exit_code: 0,
            status: "completed",
          },
        }),
      ),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");
    return {
      activation: codexExplicitSkillActivation(
        stream,
        "$ticket-to-pr",
        {
          mode: "explicit",
          skill: "ticket-to-pr",
          invocation: "$ticket-to-pr",
        },
        { repoDir: repo, installedSkillsRoots: skills },
      ),
      retained: retainedCodexEvidence(
        stream,
        repo,
        {
          exitCode: 0,
          stderrPresent: false,
          explicitlyInvokedSkill: "ticket-to-pr",
        },
        skills,
      ),
    };
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
}

test("complete adjacent source pages establish a supporting skill read", async () => {
  const result = await observe([body.slice(0, midpoint), body.slice(midpoint)]);
  expect(result.activation.complete).toBeTrue();
  expect(result.activation.observedSkills).toEqual([
    "ticket-to-pr",
    "adaptive-delivery",
  ]);
  expect(result.retained).toContain('"skill":"adaptive-delivery"');
});

test("overlapping complete source pages establish the same read without requiring duplicate-free output", async () => {
  const result = await observe([body.slice(0, midpoint), body.slice(overlap)]);
  expect(result.activation.complete).toBeTrue();
  expect(result.activation.observedSkills).toEqual([
    "ticket-to-pr",
    "adaptive-delivery",
  ]);
  expect(result.retained).toContain('"skill":"adaptive-delivery"');
  expect(result.retained).not.toContain("distinct instruction");
});

test("repeated partial pages cannot fill a missing source interval", async () => {
  for (const pages of [
    [body.slice(0, midpoint), body.slice(0, midpoint)],
    [body.slice(0, overlap), body.slice(midpoint)],
    [
      body.slice(0, midpoint),
      body.slice(overlap).replace("Final distinct", "Altered distinct"),
    ],
  ]) {
    const result = await observe(pages);
    expect(result.activation.complete).toBeFalse();
    expect(result.activation.observedSkills).toEqual(["ticket-to-pr"]);
    expect(result.retained).not.toContain('"skill":"adaptive-delivery"');
  }
});

test("compound command output can contain an overlapping exact source page", async () => {
  const result = await observe([
    body.slice(0, midpoint) +
      "\n---\nname: another-skill\nOther instructions.\n",
    body.slice(overlap),
  ]);
  expect(result.activation.complete).toBeTrue();
  expect(result.activation.observedSkills).toEqual([
    "ticket-to-pr",
    "adaptive-delivery",
  ]);
  const gap = await observe([
    body.slice(0, overlap) + "\nUnrelated output.\n",
    body.slice(midpoint),
  ]);
  expect(gap.activation.complete).toBeFalse();
});

test("native body recovery reconciles explicit completeness without repairing failed dispatch", async () => {
  const repo = await mkdtemp(join(tmpdir(), "darrow-native-pages-"));
  try {
    const skills = join(repo, ".agents/skills");
    const skill = join(skills, "adaptive-delivery");
    const config = join(repo, ".git/codex");
    const sessions = join(config, "sessions/2026/09/08");
    await mkdir(skill, { recursive: true });
    await mkdir(sessions, { recursive: true });
    await writeFile(join(skill, "SKILL.md"), body);
    const command = `cat ${skill}/SKILL.md`;
    const commandEvent = (output: string) => ({
      type: "item.completed",
      item: {
        type: "command_execution",
        command,
        aggregated_output: output,
        exit_code: 0,
        status: "completed",
      },
    });
    const nativePath = join(
      sessions,
      "rollout-2026-09-08T10-00-00-parent.jsonl",
    );
    const nativeRead = (output: string) =>
      writeFile(
        nativePath,
        JSON.stringify({
          ordinal: 1,
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
        }),
      );
    const run = (events: object[], prompt = "$ticket-to-pr") =>
      codexHarnessActivationEvidence(
        {
          repoDir: repo,
          prompt,
          model: "gpt-5.6-terra",
          effort: "medium",
          control: {
            activationProbe: {
              mode: "explicit",
              skill: "ticket-to-pr",
              invocation: "$ticket-to-pr",
            },
          },
        },
        {
          canonicalRepoDir: repo,
          configRoot: config,
          installedSkillsRoots: [skills],
          out: [{ type: "thread.started", thread_id: "parent" }, ...events]
            .map((e) => JSON.stringify(e))
            .join("\n"),
          err: "",
          code: 0,
          durationMs: 0,
        },
      );
    await nativeRead(body);
    const recovered = await run([
      commandEvent(body.slice(0, midpoint)),
      { type: "turn.completed" },
    ]);
    expect(recovered.activation.observedSkills).toContain("adaptive-delivery");
    expect(recovered.activation.complete).toBeTrue();
    expect(recovered.raw).toContain('"skill":"adaptive-delivery"');
    const publisher = join(skills, "create-pr");
    const publisherBody = "---\nname: create-pr\ndescription: Publisher\n---\n";
    await mkdir(publisher, { recursive: true });
    await writeFile(join(publisher, "SKILL.md"), publisherBody);
    const publisherItem = {
      type: "command_execution",
      command: `cat ${publisher}/SKILL.md`,
      aggregated_output: publisherBody,
      exit_code: 0,
      status: "completed",
    };
    const nativeFull = JSON.parse(await Bun.file(nativePath).text());
    await writeFile(
      nativePath,
      [
        nativeFull,
        {
          ordinal: 2,
          payload: {
            type: "item_completed",
            item: { ...publisherItem, type: "CommandExecution" },
          },
        },
      ]
        .map((e) => JSON.stringify(e))
        .join("\n"),
    );
    const ordered = await run([
      commandEvent(body.slice(0, midpoint)),
      { type: "item.completed", item: publisherItem },
      { type: "turn.completed" },
    ]);
    expect(ordered.activation.observedSkills).toEqual([
      "ticket-to-pr",
      "adaptive-delivery",
      "create-pr",
    ]);
    expect(ordered.activation.complete).toBeTrue();
    const conflicting = await run([
      { type: "item.completed", item: publisherItem },
      commandEvent(body),
      { type: "turn.completed" },
    ]);
    expect(conflicting.activation.complete).toBeFalse();
    await nativeRead(body);
    for (const events of [
      [{ type: "turn.failed" }],
      [{ type: "turn.started" }],
    ])
      expect((await run(events)).activation.complete).toBeFalse();
    expect(
      (await run([{ type: "turn.completed" }], "$ticket-to-pr $ticket-to-pr"))
        .activation.complete,
    ).toBeFalse();
    await nativeRead(body.slice(0, midpoint));
    const partial = await run([{ type: "turn.completed" }]);
    expect(partial.activation.observedSkills).not.toContain(
      "adaptive-delivery",
    );
    expect(partial.activation.complete).toBeFalse();
    const firstPage = JSON.parse(await Bun.file(nativePath).text()).payload;
    await writeFile(
      nativePath,
      [
        firstPage,
        {
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
        {
          type: "item_completed",
          item: {
            type: "SubAgentActivity",
            id: "owner-call",
            kind: "started",
            agent_thread_id: "child",
            agent_path: "/root/worker",
          },
        },
        {
          type: "function_call_output",
          call_id: "owner-call",
          output: JSON.stringify({ task_name: "/root/worker" }),
        },
      ]
        .map((payload, ordinal) => JSON.stringify({ ordinal, payload }))
        .join("\n"),
    );
    const childPath = join(sessions, "rollout-2026-09-08T10-00-01-child.jsonl");
    const childRead = (output: string) =>
      writeFile(
        childPath,
        JSON.stringify({
          ordinal: 0,
          payload: {
            ...firstPage,
            item: { ...firstPage.item, aggregated_output: output },
          },
        }),
      );
    await childRead(body.slice(overlap));
    const splitActors = await run([{ type: "turn.completed" }]);
    expect(splitActors.activation.complete).toBeFalse();
    expect(splitActors.activation.observedSkills).not.toContain(
      "adaptive-delivery",
    );
    await childRead(body);
    expect(
      (await run([{ type: "turn.completed" }])).activation.complete,
    ).toBeTrue();
    // Separate children have no shared read-order evidence. Launch-list order
    // must not become a verified ordering between their novel supporting reads.
    const parentEntries = (await Bun.file(nativePath).text()).split("\n");
    const secondLaunch = parentEntries.slice(-3).map((line, index) => {
      const event = JSON.parse(
        line
          .replaceAll("owner-call", "second-call")
          .replaceAll('"child"', '"sibling"')
          .replaceAll("/root/worker", "/root/second"),
      );
      event.ordinal = parentEntries.length + index;
      return JSON.stringify(event);
    });
    await writeFile(nativePath, [...parentEntries, ...secondLaunch].join("\n"));
    await writeFile(
      join(sessions, "rollout-2026-09-08T10-00-02-sibling.jsonl"),
      JSON.stringify({
        ordinal: 0,
        payload: {
          type: "item_completed",
          item: { ...publisherItem, type: "CommandExecution" },
        },
      }),
    );
    const siblings = await run([{ type: "turn.completed" }]);
    expect(siblings.activation.observedSkills).toContain("adaptive-delivery");
    expect(siblings.activation.observedSkills).toContain("create-pr");
    expect(siblings.activation.complete).toBeFalse();
    const anchoredSiblings = await run([
      commandEvent(body),
      { type: "item.completed", item: publisherItem },
      { type: "turn.completed" },
    ]);
    expect(anchoredSiblings.activation.complete).toBeTrue();
    await writeFile(
      nativePath,
      (await Bun.file(nativePath).text()) + "\nmalformed",
    );
    expect(
      (await run([{ type: "turn.completed" }])).activation.complete,
    ).toBeFalse();
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
