import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexHarnessActivationEvidence } from "./codex";

test("native recovery restores an earlier partial stream read instead of ordering its reread last", async () => {
  const repo = await mkdtemp(join(tmpdir(), "darrow-native-read-order-"));
  try {
    const roots = join(repo, ".agents/skills");
    const config = join(repo, "config");
    const sessions = join(config, "sessions");
    await mkdir(sessions, { recursive: true });
    const names = [
      "prepare-task-branch",
      "create-commit",
      "ship-proposal",
    ] as const;
    const bodies = names.map(
      (name) =>
        `---\nname: ${name}\ndescription: Distinct ${name} instructions\n---\n# ${name}\nRead the complete instructions for ${name}.\nFinal instruction for ${name}.\n`,
    );
    for (const [index, name] of names.entries()) {
      await mkdir(join(roots, name), { recursive: true });
      await writeFile(join(roots, name, "SKILL.md"), bodies[index]!);
    }
    const command = names
      .map((name) => `cat ${roots}/${name}/SKILL.md`)
      .join(" && ");
    const item = (output: string, commandText = command) => ({
      type: "command_execution",
      command: commandText,
      aggregated_output: output,
      exit_code: 0,
      status: "completed",
    });
    const reread = item(bodies[0]!, `cat ${roots}/${names[0]}/SKILL.md`);
    const partial =
      bodies[0]!.slice(0, -30) + "\n[truncated]\n" + bodies.slice(1).join("");
    const writeNative = (outputs: ReturnType<typeof item>[]) =>
      writeFile(
        join(sessions, "rollout-parent.jsonl"),
        outputs
          .map((read, ordinal) =>
            JSON.stringify({
              ordinal,
              payload: {
                type: "item_completed",
                item: { ...read, type: "CommandExecution" },
              },
            }),
          )
          .join("\n"),
      );
    const observe = (
      outputs: ReturnType<typeof item>[],
      prompt = "$ticket-to-pr",
    ) =>
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
          installedSkillsRoots: [roots],
          out: [
            { type: "thread.started", thread_id: "parent" },
            ...outputs.map((read) => ({ type: "item.completed", item: read })),
            { type: "turn.completed" },
          ]
            .map((row) => JSON.stringify(row))
            .join("\n"),
          err: "",
          code: 0,
          durationMs: 0,
        },
      );
    await writeNative([item(bodies.join("")), reread]);
    const recovered = await observe([item(partial), reread]);
    expect(recovered.activation.observedSkills).toEqual([
      "ticket-to-pr",
      ...names,
    ]);
    expect(recovered.activation.complete).toBeTrue();
    const order = recovered.raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .find((record) => record.type === "darrow.codex_native_skill_order");
    expect(order).toMatchObject({
      stream_skills: ["ticket-to-pr", names[1], names[2], names[0]],
      native_skills: ["ticket-to-pr", ...names],
      anchored_stream_reads: [...names],
      recovered_earlier_skills: [names[0]],
      order_consistent: true,
      diagnostics_truncated: false,
    });
    expect(recovered.raw).not.toContain("Final instruction");
    expect(recovered.raw).not.toContain(repo);

    const bothPartial =
      bodies
        .slice(0, 2)
        .map((body) => body.slice(0, -30) + "\n[truncated]\n")
        .join("") + bodies[2];
    const multiple = await observe([
      item(bothPartial),
      reread,
      item(bodies[1]!, `cat ${roots}/${names[1]}/SKILL.md`),
    ]);
    expect(multiple.activation.complete).toBeTrue();
    expect(multiple.activation.observedSkills).toEqual([
      "ticket-to-pr",
      ...names,
    ]);

    // A genuine conflicting complete order has no earlier partial-read anchor.
    const conflicting = await observe([item(bodies.slice(1).join("")), reread]);
    expect(conflicting.activation.complete).toBeFalse();
    // A path alone and non-reader output do not create that anchor.
    for (const early of [
      item(""),
      item(partial, `echo ${roots}/${names[0]}/SKILL.md`),
    ]) {
      const unanchored = await observe([
        early,
        item(bodies.slice(1).join("")),
        reread,
      ]);
      expect(unanchored.activation.complete).toBeFalse();
    }
    // Native partial evidence cannot promote a skill ahead of its real completion.
    await writeNative([item(partial), reread]);
    const delayed = await observe([item(partial), reread]);
    expect(delayed.activation.complete).toBeTrue();
    expect(delayed.activation.observedSkills).toEqual([
      "ticket-to-pr",
      names[1],
      names[2],
      names[0],
    ]);
    await writeNative([item(bodies.join("")), reread]);
    expect(
      (await observe([item(partial), reread], "$ticket-to-pr $ticket-to-pr"))
        .activation.complete,
    ).toBeFalse();
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
