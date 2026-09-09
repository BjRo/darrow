import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  codexAdapter,
  codexArgv,
  codexEvalSkillsRoot,
  codexExplicitSkillActivation,
  codexNativeSessionForThread,
  codexResumeArgv,
  codexRunSucceeded,
  codexSkillActivation,
  codexSpawnGuardRequested,
  codexThreadId,
  codexTokenUsage,
  retainedCodexEvidence,
  retainedCodexEvidenceForThread,
} from "./codex";
import { observeCodexTicketPipelineRoutes } from "../orchestration-metrics";
import { gradeActivation } from "../activation";
import {
  fixtureStateFingerprint,
  guardCodexSpawn,
  repositoryFingerprint,
  verifiedCodexAcceptedOwner,
} from "../codex-spawn-guard";

const REPO = "/tmp/eval";
const COMPLETE_CONTRACT = [
  "Role: You are the already-launched sole engineering owner. Perform this contract directly; do not invoke adaptive-goal or seek another owner.",
  "Outcome: Implement the requested fixture behavior.",
  "Acceptance criteria: The requested behavior and checks pass.",
  "Scope and authority: included=fixture implementation and tests; authorized=local edits and checks only; forbidden=publication; preserve=unrelated repository state",
  "Execution: workflow=implement-feature; sequence=inspect fixture, implement behavior, run checks; risk=routine; profile=routine; route=codex|openai|gpt-5.6-luna|low; capabilities=none",
  "Verification and gates: readiness=not required; review=not required; focused=run the focused test; final=run the repository gate; feedback=return the smallest complete question; blockers=return concrete evidence and the smallest next action",
  "Completion evidence: report status, files, checks, and remaining risks.",
].join("\n");

test("uses Terra as the default Codex eval model", () => {
  expect(codexAdapter.defaultModel).toBe("gpt-5.6-terra");
});

test("installs the adaptive-goal spawn guard only for relevant turns", () => {
  expect(
    codexSpawnGuardRequested("Implement the bounded refactor."),
  ).toBeFalse();
  expect(
    codexSpawnGuardRequested("Invoke adaptive-goal for this request."),
  ).toBeTrue();
  expect(
    codexSpawnGuardRequested(
      "Assess the ticket first.",
      "Now invoke adaptive-goal for the unchanged scope.",
    ),
  ).toBeTrue();
});

test("builds one persistent Codex session and one exact follow-up resume", () => {
  const initial = codexArgv({
    repoDir: REPO,
    prompt: "first",
    model: "gpt-5.5",
    effort: "medium",
  });
  expect(initial).not.toContain("--ephemeral");
  const resumed = codexResumeArgv({
    repoDir: REPO,
    threadId: "thread-123",
    prompt: "answer",
    model: "gpt-5.5",
    effort: "medium",
  });
  expect(resumed.slice(0, 5)).toEqual([
    "codex",
    "exec",
    "resume",
    "thread-123",
    "answer",
  ]);
  expect(resumed).not.toContain("--ephemeral");
});

test("keeps an ordinary Codex eval session for bounded evidence extraction", () => {
  const argv = codexArgv({
    repoDir: REPO,
    prompt: "review",
    model: "gpt-5.6-terra",
    effort: "medium",
  });
  expect(argv).not.toContain("--ephemeral");
});

test("requires exactly one Codex thread id before resuming", () => {
  expect(
    codexThreadId(
      [
        JSON.stringify({ type: "thread.started", thread_id: "thread-123" }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n"),
    ),
  ).toBe("thread-123");
  expect(
    codexThreadId(
      [
        JSON.stringify({ type: "thread.started", thread_id: "one" }),
        JSON.stringify({ type: "thread.started", thread_id: "two" }),
      ].join("\n"),
    ),
  ).toBeUndefined();
});

test("loads the one native session bound to the Codex thread", async () => {
  const configRoot = await mkdtemp(join(tmpdir(), "darrow-codex-session-"));
  try {
    expect(
      await codexNativeSessionForThread(configRoot, "thread-123"),
    ).toBeUndefined();
    const sessionRoot = join(configRoot, "sessions", "2026", "09", "06");
    await mkdir(sessionRoot, { recursive: true });
    const expected = '{"ordinal":0,"payload":{"type":"session_meta"}}\n';
    await writeFile(
      join(sessionRoot, "rollout-2026-09-06T10-00-00-thread-123.jsonl"),
      expected,
    );
    await writeFile(
      join(sessionRoot, "rollout-2026-09-06T10-00-01-other-thread.jsonl"),
      "decoy\n",
    );
    expect(await codexNativeSessionForThread(configRoot, "thread-123")).toBe(
      expected,
    );
    const secondRoot = join(configRoot, "sessions", "2026", "09", "07");
    await mkdir(secondRoot, { recursive: true });
    await writeFile(
      join(secondRoot, "rollout-2026-09-07T10-00-00-thread-123.jsonl"),
      expected,
    );
    expect(
      await codexNativeSessionForThread(configRoot, "thread-123"),
    ).toBeUndefined();
  } finally {
    await rm(configRoot, { recursive: true, force: true });
  }
});

test("Codex no-skill control does not require a plugin package", async () => {
  expect(await codexEvalSkillsRoot(REPO, {})).toBe(
    `${REPO}/.git/eval-no-skills`,
  );
});

describe("Codex terminal stream state", () => {
  test("accepts a recovered reconnect error followed by completion", () => {
    const stream = [
      JSON.stringify({ type: "error", message: "Reconnecting..." }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");
    expect(codexRunSucceeded(0, stream)).toBe(true);
    expect(
      codexRunSucceeded(
        0,
        JSON.stringify({ type: "event_msg", msg: { type: "turn.completed" } }),
      ),
    ).toBe(true);
  });

  test("rejects terminal failure, missing completion, and nonzero exit", () => {
    expect(codexRunSucceeded(0, JSON.stringify({ type: "turn.failed" }))).toBe(
      false,
    );
    expect(
      codexRunSucceeded(
        0,
        [
          JSON.stringify({ type: "turn.completed" }),
          JSON.stringify({ type: "event_msg", msg: { type: "turn.failed" } }),
        ].join("\n"),
      ),
    ).toBe(false);
    expect(codexRunSucceeded(0, JSON.stringify({ type: "error" }))).toBe(false);
    expect(
      codexRunSucceeded(1, JSON.stringify({ type: "turn.completed" })),
    ).toBe(false);
  });
});

describe("Codex token accounting", () => {
  test("uses the last complete cumulative usage report", () => {
    const stream = [
      JSON.stringify({
        type: "turn.started",
        usage: { input_tokens: 3, output_tokens: 2 },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 11, output_tokens: 7 },
      }),
    ].join("\n");
    expect(codexTokenUsage(stream)).toEqual({
      complete: true,
      inputTokens: 11,
      outputTokens: 7,
    });
  });

  test("marks missing, partial, malformed, or invalid usage unknown", () => {
    for (const stream of [
      JSON.stringify({ type: "turn.completed" }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 4 },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: "wrong", output_tokens: 2 },
      }),
      [
        JSON.stringify({
          type: "turn.completed",
          usage: { input_tokens: 4, output_tokens: 2 },
        }),
        '{"type":"event_msg",broken',
      ].join("\n"),
    ]) {
      expect(codexTokenUsage(stream)).toEqual({
        complete: false,
        inputTokens: 0,
        outputTokens: 0,
      });
    }
  });
});

describe("Codex skill activation observation", () => {
  test("explicit activation ignores a complete read outside the mounted skill root", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-explicit-unmounted-"));
    const root = join(repo, ".agents/skills");
    const decoy = join(repo, "docs/grilling/SKILL.md");
    const body =
      "---\nname: grilling\ndescription: Ask questions\n---\nComplete required instructions.\n";
    try {
      await mkdir(join(root, "grilling"), { recursive: true });
      await mkdir(join(repo, "docs/grilling"), { recursive: true });
      await writeFile(join(root, "grilling/SKILL.md"), body);
      await writeFile(decoy, body);
      const stream = [
        {
          type: "item.completed",
          item: {
            type: "command_execution",
            command: `cat ${decoy}`,
            aggregated_output: body,
            status: "completed",
            exit_code: 0,
          },
        },
        { type: "turn.completed" },
      ]
        .map((event) => JSON.stringify(event))
        .join("\n");
      const observation = codexExplicitSkillActivation(
        stream,
        "$sample:plan-implementation",
        {
          mode: "explicit",
          skill: "plan-implementation",
          invocation: "$sample:plan-implementation",
        },
        { repoDir: repo, installedSkillsRoots: root },
      );
      expect(observation).toMatchObject({
        complete: true,
        primarySkill: "plan-implementation",
        observedSkills: ["plan-implementation"],
      });
      expect(
        gradeActivation("positive", "plan-implementation", observation, {
          sequence: ["plan-implementation", "grilling"],
        }).passed,
      ).toBe(false);
      expect(
        gradeActivation("positive", "plan-implementation", observation, {
          excludes: ["grilling"],
        }).passed,
      ).toBe(true);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  test("a truncated first supporting read cannot prove an explicit exclusion", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-explicit-truncated-"));
    const root = join(repo, ".agents/skills");
    const frontmatter =
      "---\nname: grilling\ndescription: Ask questions\n---\n";
    try {
      await mkdir(join(root, "grilling"), { recursive: true });
      await writeFile(
        join(root, "grilling/SKILL.md"),
        `${frontmatter}Complete required instructions.\n`,
      );
      const stream = [
        {
          type: "item.completed",
          item: {
            type: "command_execution",
            command: `cat ${root}/grilling/SKILL.md`,
            aggregated_output: frontmatter,
            status: "completed",
            exit_code: 0,
          },
        },
        { type: "turn.completed" },
      ]
        .map((event) => JSON.stringify(event))
        .join("\n");
      const observation = codexExplicitSkillActivation(
        stream,
        "$sample:plan-implementation",
        {
          mode: "explicit",
          skill: "plan-implementation",
          invocation: "$sample:plan-implementation",
        },
        { repoDir: repo, installedSkillsRoots: root },
      );
      expect(observation.observedSkills).toEqual(["plan-implementation"]);
      expect(
        gradeActivation("positive", "plan-implementation", observation, {
          excludes: ["grilling"],
        }).passed,
      ).toBeNull();
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  test("explicit activation grades supporting reads in sequences and exclusions", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-explicit-activation-"));
    const root = join(repo, ".agents/skills");
    const body =
      "---\nname: grilling\ndescription: Ask the decision frontier\n---\nRead the full instructions before asking.\n";
    try {
      await mkdir(join(root, "grilling"), { recursive: true });
      await writeFile(join(root, "grilling/SKILL.md"), body);
      const read = {
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${root}/grilling/SKILL.md`,
          aggregated_output: body,
          exit_code: 0,
          status: "completed",
        },
      };
      const stream = [read, read, { type: "turn.completed" }]
        .map((event) => JSON.stringify(event))
        .join("\n");
      const observation = codexExplicitSkillActivation(
        stream,
        "Use $sample:plan-implementation",
        {
          mode: "explicit",
          skill: "plan-implementation",
          invocation: "$sample:plan-implementation",
        },
        { repoDir: repo, installedSkillsRoots: root },
      );
      expect(observation).toMatchObject({
        source: "explicit_invocation",
        complete: true,
        primarySkill: "plan-implementation",
        observedSkills: ["plan-implementation", "grilling"],
      });
      expect(
        gradeActivation("positive", "plan-implementation", observation, {
          sequence: ["plan-implementation", "grilling"],
        }).passed,
      ).toBe(true);
      expect(
        gradeActivation("positive", "plan-implementation", observation, {
          excludes: ["grilling"],
        }).passed,
      ).toBe(false);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  test("uses one explicit host invocation without requiring a skill-file read", () => {
    const stream = JSON.stringify({ type: "turn.completed" });
    expect(
      codexExplicitSkillActivation(
        stream,
        "Use $sample:grilling for this request.",
        {
          mode: "explicit",
          skill: "grilling",
          invocation: "$sample:grilling",
        },
      ),
    ).toEqual({
      source: "explicit_invocation",
      complete: true,
      primarySkill: "grilling",
      observedSkills: ["grilling"],
    });
  });

  test.each([
    [
      "missing token",
      "Use the appropriate skill.",
      '{"type":"turn.completed"}',
    ],
    [
      "duplicated token",
      "Use $sample:grilling, then $sample:grilling again.",
      '{"type":"turn.completed"}',
    ],
    [
      "malformed stream",
      "Use $sample:grilling.",
      '{"type":"item.completed",broken\n{"type":"turn.completed"}',
    ],
    ["failed turn", "Use $sample:grilling.", '{"type":"turn.failed"}'],
  ])("keeps %s explicit evidence unknown", (_label, prompt, stream) => {
    expect(
      codexExplicitSkillActivation(stream, prompt, {
        mode: "explicit",
        skill: "grilling",
        invocation: "$sample:grilling",
      }),
    ).toEqual({
      source: "explicit_invocation",
      complete: false,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("keeps a no-plugin control complete without inventing a project skill", () => {
    const stream = JSON.stringify({ type: "turn.completed" });
    expect(
      codexSkillActivation(stream, REPO, `${REPO}/.git/eval-no-skills`),
    ).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("keeps a missing implicit observation channel unknown", () => {
    expect(codexSkillActivation("", REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: false,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("uses completed mounted SKILL.md reads as an ordered controlled probe", () => {
    const stream = [
      JSON.stringify({ type: "turn.started" }),
      JSON.stringify({
        type: "item.started",
        item: {
          type: "command_execution",
          command:
            "sed -n '1,260p' /tmp/eval/.agents/skills/plan-implementation/SKILL.md",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            "sed -n '1,260p' /tmp/eval/.agents/skills/plan-implementation/SKILL.md",
          aggregated_output:
            "---\nname: plan-implementation\ndescription: Plan\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            '/bin/zsh -lc "cat /tmp/eval/.agents/skills/grilling/SKILL.md && pwd"',
          aggregated_output: "---\nname: grilling\ndescription: Grill\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "plan-implementation",
      observedSkills: ["plan-implementation", "grilling"],
    });
  });

  test("observes matching mounted skill bodies across Codex read shapes", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "sed -n '1,260p' './.agents/skills/adaptive-goal/SKILL.md'",
          aggregated_output:
            "---\nname: adaptive-goal\ndescription: Orchestrate\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            "/bin/zsh -lc \"lean-ctx -c 'sed -n 1,260p /tmp/eval/.agents/skills/grilling/SKILL.md'\"",
          aggregated_output: "---\nname: grilling\ndescription: Grill\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "adaptive-goal",
      observedSkills: ["adaptive-goal", "grilling"],
    });
  });

  test("observes mounted skill bodies read through shell indirections", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "codex-skill-probe-"));
    const skillsRoot = join(temporary, "skills");
    const skillDirectory = join(skillsRoot, "grilling");
    const skillBody = [
      "---",
      "name: grilling",
      "description: Help prepare food over direct heat.",
      "---",
      "",
      "# Grilling",
      "",
      "Inspect the food before giving advice.",
      "",
    ].join("\n");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(join(skillDirectory, "SKILL.md"), skillBody);

    try {
      const commands = [
        `skills_root=${skillsRoot}; skill=grilling; cat "$skills_root/$skill/SKILL.md"`,
        `cd ${skillDirectory} && sed -n '1,80p' SKILL.md`,
        `skill_file=$(find ${skillsRoot} -path '*/grilling/SKILL.md' -print -quit); sed -n '1,80p' "$skill_file"`,
      ];
      for (const command of commands) {
        const stream = [
          JSON.stringify({
            type: "item.completed",
            item: {
              type: "command_execution",
              command,
              aggregated_output: skillBody,
              exit_code: 0,
              status: "completed",
            },
          }),
          JSON.stringify({ type: "turn.completed" }),
        ].join("\n");

        expect(codexSkillActivation(stream, REPO, skillsRoot)).toEqual({
          source: "skill_file_read_probe",
          complete: true,
          primarySkill: "grilling",
          observedSkills: ["grilling"],
        });
        expect(
          retainedCodexEvidence(stream, REPO, undefined, skillsRoot),
        ).toContain('"skill":"grilling"');
      }
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  test("requires a complete mounted body for a supporting skill read", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "codex-composed-probe-"));
    const skillsRoot = join(temporary, "skills");
    const planBody = [
      "---",
      "name: plan-implementation",
      "description: Plan an implementation.",
      "---",
      "",
      "# Plan implementation",
      "",
      "Inspect the repository before planning.",
      "",
    ].join("\n");
    const grillingBody = [
      "---",
      "name: grilling",
      "description: Resolve material unknowns.",
      "---",
      "",
      "# Grilling",
      "",
      "Ask dependency-aware questions.",
      "",
    ].join("\n");
    await mkdir(join(skillsRoot, "plan-implementation"), { recursive: true });
    await mkdir(join(skillsRoot, "grilling"), { recursive: true });
    await writeFile(
      join(skillsRoot, "plan-implementation", "SKILL.md"),
      planBody,
    );
    await writeFile(join(skillsRoot, "grilling", "SKILL.md"), grillingBody);

    try {
      const event = (skill: string, output: string) =>
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "command_execution",
            command: `cat ${skillsRoot}/${skill}/SKILL.md`,
            aggregated_output: output,
            exit_code: 0,
            status: "completed",
          },
        });
      const stream = [
        event("plan-implementation", planBody),
        event("grilling", grillingBody.split("# Grilling")[0] ?? ""),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n");

      expect(codexSkillActivation(stream, REPO, skillsRoot)).toEqual({
        source: "skill_file_read_probe",
        complete: true,
        primarySkill: "plan-implementation",
        observedSkills: ["plan-implementation"],
      });
      expect(
        retainedCodexEvidence(stream, REPO, undefined, skillsRoot),
      ).not.toContain('"skill":"grilling"');
      const partialPrimary = [
        event("grilling", grillingBody.split("# Grilling")[0] ?? ""),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n");
      expect(
        codexSkillActivation(partialPrimary, REPO, skillsRoot).observedSkills,
      ).toEqual([]);
      expect(
        retainedCodexEvidence(partialPrimary, REPO, undefined, skillsRoot),
      ).not.toContain('"skill":"grilling"');
      expect(
        retainedCodexEvidence(
          event("grilling", grillingBody.split("# Grilling")[0] ?? ""),
          REPO,
          {
            exitCode: 0,
            stderrPresent: false,
            explicitlyInvokedSkill: "plan-implementation",
          },
          skillsRoot,
        ),
      ).not.toContain('"skill":"grilling"');
      const paginated = [
        stream,
        event("grilling", "# Grilling" + grillingBody.split("# Grilling")[1]),
      ].join("\n");
      expect(
        codexSkillActivation(paginated, REPO, skillsRoot).observedSkills,
      ).toEqual(["plan-implementation", "grilling"]);
      expect(
        retainedCodexEvidence(paginated, REPO, undefined, skillsRoot),
      ).toContain('"skill":"grilling"');
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  test("rejects indirect output that is not a mounted skill body", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "codex-skill-probe-"));
    const skillsRoot = join(temporary, "skills");
    const skillDirectory = join(skillsRoot, "grilling");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      join(skillDirectory, "SKILL.md"),
      "---\nname: grilling\ndescription: Mounted body.\n---\n",
    );

    try {
      const stream = [
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "command_execution",
            command: `root=${skillsRoot}; cat "$root/decoy/SKILL.md"`,
            aggregated_output:
              "---\nname: decoy\ndescription: Unmounted body.\n---\n",
            exit_code: 0,
            status: "completed",
          },
        }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n");

      expect(codexSkillActivation(stream, REPO, skillsRoot)).toEqual({
        source: "skill_file_read_probe",
        complete: true,
        primarySkill: null,
        observedSkills: [],
      });
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  test("does not infer an indirect read from fabricated mounted frontmatter", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "codex-skill-probe-"));
    const skillsRoot = join(temporary, "skills");
    const skillDirectory = join(skillsRoot, "grilling");
    const skillBody = "---\nname: grilling\ndescription: Mounted body.\n---\n";
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(join(skillDirectory, "SKILL.md"), skillBody);

    try {
      const commands = [
        `test -f ${skillDirectory}/SKILL.md; printf '%s' fabricated`,
        `find ${skillsRoot} -name SKILL.md -exec printf '%s' fabricated \\;`,
        `find ${skillsRoot} -name SKILL.md -print; cat /tmp/decoy/SKILL.md; printf '%s' fabricated`,
      ];
      for (const command of commands) {
        const stream = [
          JSON.stringify({
            type: "item.completed",
            item: {
              type: "command_execution",
              command,
              aggregated_output: skillBody,
              exit_code: 0,
              status: "completed",
            },
          }),
          JSON.stringify({ type: "turn.completed" }),
        ].join("\n");

        expect(
          codexSkillActivation(stream, REPO, skillsRoot).primarySkill,
        ).toBeNull();
      }
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  test("observes canonical skill reads from an installed plugin cache", () => {
    const skillsRoot =
      "/tmp/eval-home/plugins/cache/darrow/darrow-discovery/0.1.0/skills";
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${skillsRoot}/plan-implementation/SKILL.md`,
          aggregated_output:
            "---\nname: plan-implementation\ndescription: Plan\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${skillsRoot}/grilling/SKILL.md`,
          aggregated_output: "---\nname: grilling\ndescription: Grill\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO, skillsRoot)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "plan-implementation",
      observedSkills: ["plan-implementation", "grilling"],
    });
  });

  test("observes repository-relative reads from an installed plugin cache", () => {
    const skillsRoot = join(
      REPO,
      ".git/darrow-eval/state/codex/config/plugins/cache/darrow-eval/darrow-tickets/0.2.3/skills",
    );
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            "sed -n '1,240p' .git/darrow-eval/state/codex/config/plugins/cache/darrow-eval/darrow-tickets/0.2.3/skills/list-tickets/SKILL.md",
          aggregated_output:
            "---\nname: list-tickets\ndescription: List tickets\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO, skillsRoot)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "list-tickets",
      observedSkills: ["list-tickets"],
    });
    expect(
      retainedCodexEvidence(stream, REPO, undefined, skillsRoot),
    ).toContain('"skill":"list-tickets"');
  });

  test("observes project capability reads alongside an installed orchestrator", () => {
    const installedSkillsRoot =
      "/tmp/eval-home/plugins/cache/darrow/darrow-goal-loop/0.13.0/skills";
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${installedSkillsRoot}/adaptive-goal/SKILL.md`,
          aggregated_output:
            "---\nname: adaptive-goal\ndescription: Orchestrate\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            "cat /tmp/eval/.agents/skills/assess-implementation-readiness/SKILL.md",
          aggregated_output:
            "---\nname: assess-implementation-readiness\ndescription: Assess\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO, installedSkillsRoot)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "adaptive-goal",
      observedSkills: ["adaptive-goal", "assess-implementation-readiness"],
    });
    expect(
      retainedCodexEvidence(stream, REPO, undefined, installedSkillsRoot),
    ).toContain('"skill":"assess-implementation-readiness"');
  });

  test("observes skills from independently installed composition plugins", () => {
    const recipeRoot =
      "/tmp/eval-home/plugins/cache/darrow/recipe/0.3.0/skills";
    const goalRoot =
      "/tmp/eval-home/plugins/cache/darrow/darrow-goal-loop/0.13.1/skills";
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${recipeRoot}/ticket-to-pr/SKILL.md`,
          aggregated_output: "---\nname: ticket-to-pr\ndescription: Recipe\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${goalRoot}/adaptive-goal/SKILL.md`,
          aggregated_output: "---\nname: adaptive-goal\ndescription: Goal\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO, [recipeRoot, goalRoot])).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "ticket-to-pr",
      observedSkills: ["ticket-to-pr", "adaptive-goal"],
    });
  });

  test("observes every installed skill read in one compound command", () => {
    const skillsRoot =
      "/tmp/eval-home/plugins/cache/darrow/darrow-discovery/0.1.0/skills";
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${skillsRoot}/plan-implementation/SKILL.md && cat ${skillsRoot}/grilling/SKILL.md`,
          aggregated_output: [
            "---\nname: plan-implementation\ndescription: Plan\n",
            "---\nname: grilling\ndescription: Grill\n",
          ].join(""),
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO, skillsRoot)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "plan-implementation",
      observedSkills: ["plan-implementation", "grilling"],
    });
  });

  test("does not treat a path existence check as reading a skill body", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "test -f /tmp/eval/.agents/skills/grilling/SKILL.md",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");
    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("marks a malformed JSON event channel incomplete", () => {
    const stream = [
      "ordinary CLI noise",
      '{"type":"item.completed",broken',
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");
    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: false,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("keeps the observation channel complete after an ordinary failed command", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "rg missing file",
          aggregated_output: "file: No such file\n",
          exit_code: 2,
          status: "failed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");
    expect(codexSkillActivation(stream, REPO).complete).toBe(true);
  });

  test("observes a verified skill read before a later compound command fails", () => {
    const skillBody = "---\nname: grilling\ndescription: Grill\n---\n";
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            "cat /tmp/eval/.agents/skills/grilling/SKILL.md && rg missing",
          aggregated_output: skillBody,
          exit_code: 1,
          status: "failed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "grilling",
      observedSkills: ["grilling"],
    });
  });

  test("keeps ambiguous implicit command evidence unknown", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "cat /tmp/eval/.agents/skills/grilling/SKILL.md",
          aggregated_output: "---\nname: grilling\ndescription: Grill\n",
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: false,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("ignores decoy skill paths outside the mounted fixture root", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "cat /tmp/decoy/.agents/skills/grilling/SKILL.md",
          aggregated_output: "---\nname: grilling\ndescription: Decoy\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("rejects command-shaped text and reads that return no skill body", () => {
    for (const command of [
      "echo cat /tmp/eval/.agents/skills/grilling/SKILL.md",
      "cat /tmp/eval/.agents/skills/grilling/SKILL.md >/dev/null",
      "head -n 0 /tmp/eval/.agents/skills/grilling/SKILL.md",
    ]) {
      const stream = [
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "command_execution",
            command,
            aggregated_output: command.startsWith("echo")
              ? "cat /tmp/eval/.agents/skills/grilling/SKILL.md\n"
              : "",
            exit_code: 0,
            status: "completed",
          },
        }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n");

      expect(codexSkillActivation(stream, REPO).primarySkill).toBeNull();
    }
  });

  test("retains bounded probe and accounting records without transcript text", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "sensitive agent narration" },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "cat /tmp/eval/.agents/skills/grilling/SKILL.md",
          aggregated_output:
            "---\nname: grilling\ndescription: sensitive skill body\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 10, output_tokens: 2 },
      }),
    ].join("\n");

    const retained = retainedCodexEvidence(stream, REPO);
    expect(retained).toContain('"type":"darrow.skill_read_probe"');
    expect(retained).toContain('"skill":"grilling"');
    expect(retained).toContain('"input_tokens":10');
    expect(retained).not.toContain("sensitive agent narration");
    expect(retained).not.toContain("sensitive skill body");
  });

  test("retains only collaboration fields the live Codex stream exposes", () => {
    const stream = [
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "in_progress",
          sender_thread_id: "parent-thread",
          receiver_thread_ids: ["child-1"],
          model: "gpt-5.6-sol",
          reasoning_effort: "xhigh",
          fork_turns: "none",
          prompt: "- review_axis: standards\nsensitive task context",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "completed",
          receiver_thread_ids: ["child-1"],
          prompt: [
            "sensitive task context",
            "- phase: refine",
            "- iteration: 1",
            "- stable_child_id: refine-1-run",
            "- phase_skill: $refine-ticket",
          ].join("\n"),
        },
      }),
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "in_progress",
          receiver_thread_ids: ["child-2"],
          model: "gpt-5.6-sol",
          reasoning_effort: "xhigh",
          fork_turns: "none",
          prompt:
            "- phase: adaptive-goal-runner\nsensitive copied context\n- phase: confidential-acquisition\n- stable_child_id: patient-123\n- review_axis: spec",
        },
      }),
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "wait_agent",
          status: "in_progress",
          receiver_thread_ids: ["child-1"],
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "feedbackctl answer rounding-mode",
          exit_code: 0,
          status: "completed",
          aggregated_output: "nearest\n",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    const retained = retainedCodexEvidence(stream, REPO);
    expect(retained).toContain('"type":"item.started"');
    expect(retained).toContain('"model":"gpt-5.6-sol"');
    expect(retained).toContain('"reasoning_effort":"xhigh"');
    expect(retained).toContain('"fork_turns":"none"');
    expect(retained).toContain('"tool":"wait_agent"');
    expect(retained).toContain('"sender_thread_id":"parent-thread"');
    expect(retained).toContain("- review_axis: standards");
    expect(retained).toContain("- phase: adaptive-goal-runner");
    expect(retained).not.toContain("confidential-acquisition");
    expect(retained).not.toContain("patient-123");
    expect(retained).toContain(
      '"type":"darrow.human_feedback_answer","feedback_id":"rounding-mode","status":"completed"',
    );
    expect(retained).not.toContain("nearest");
    expect(retained).not.toContain("- review_axis: spec");
    expect(retained.match(/"tool":"spawn_agent"/g)).toHaveLength(3);
    expect(observeCodexTicketPipelineRoutes(retained)).toEqual([
      {
        phase: "refine",
        iteration: 1,
        childId: "refine-1-run",
        skill: "refine-ticket",
        threadId: "child-1",
      },
    ]);
    expect(retained).not.toContain("sensitive task context");
  });

  test("retains current review task labels and route fields", () => {
    const childId = "01a04f35-c37a-74b3-baa4-961bc21b6f49";
    const stream = [
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "in_progress",
          sender_thread_id: "parent-thread",
          receiver_thread_ids: [childId],
          task_name: "review_standards",
          model: "gpt-5.6-sol",
          reasoning_effort: "xhigh",
          fork_turns: "none",
          prompt: "- review_axis: standards\nsensitive task context",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "completed",
          sender_thread_id: "parent-thread",
          receiver_thread_ids: [childId],
          task_name: "review_standards",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    const retained = retainedCodexEvidence(stream, REPO);
    expect(retained).toContain('"tool":"spawn_agent"');
    expect(retained).toContain(`"agent_ref":"${childId}"`);
    expect(retained).toContain('"task_name":"review_standards"');
    expect(retained).toContain('"model":"gpt-5.6-sol"');
    expect(retained).toContain('"reasoning_effort":"xhigh"');
    expect(retained).toContain('"fork_turns":"none"');
    expect(retained).toContain('"event_type":"item.completed"');
    expect(retained).toContain('"launch_accepted":true');
    expect(retained).toContain("- review_axis: standards");
    expect(retained).not.toContain("sensitive task context");
  });

  test("merges bounded accepted-launch evidence from the native session", () => {
    const nativeEntry = (ordinal: number, payload: Record<string, unknown>) =>
      JSON.stringify({
        timestamp: `2026-09-06T10:00:0${ordinal}.000Z`,
        ordinal,
        type: "response_item",
        payload,
      });
    const nativeSession = [
      nativeEntry(1, {
        type: "function_call",
        name: "spawn_agent",
        namespace: "collaboration",
        call_id: "call-standards",
        arguments: JSON.stringify({
          task_name: "review_standards",
          fork_turns: "none",
          model: "gpt-5.6-sol",
          reasoning_effort: "xhigh",
          message: "gAAAAABencrypted-native-child-prompt",
        }),
      }),
      nativeEntry(2, {
        type: "item_completed",
        item: {
          type: "SubAgentActivity",
          id: "call-standards",
          kind: "started",
          agent_thread_id: "01a04f35-c37a-74b3-baa4-961bc21b6f49",
          agent_path: "/root/review_standards",
        },
      }),
      nativeEntry(3, {
        type: "function_call_output",
        call_id: "call-standards",
        output: JSON.stringify({ task_name: "/root/review_standards" }),
      }),
      nativeEntry(4, {
        type: "function_call",
        name: "wait_agent",
        namespace: "collaboration",
        call_id: "call-wait",
        arguments: "{}",
      }),
    ].join("\n");

    const retained = retainedCodexEvidence(
      JSON.stringify({ type: "turn.completed" }),
      REPO,
      { exitCode: 0, stderrPresent: false, nativeSession },
      join(REPO, ".agents", "skills"),
    );
    expect(retained).toContain('"type":"darrow.codex_native_spawn"');
    expect(retained).toContain('"status":"accepted"');
    expect(retained).toContain('"call_id":"call-standards"');
    expect(retained).toContain('"agent_ref":"/root/review_standards"');
    expect(retained).toContain('"task_name":"review_standards"');
    expect(retained).toContain('"model":"gpt-5.6-sol"');
    expect(retained).toContain('"reasoning_effort":"xhigh"');
    expect(retained).toContain('"fork_turns":"none"');
    expect(retained).toContain('"review_axis":"standards"');
    expect(retained).toContain('"type":"darrow.codex_native_wait"');
    expect(retained).not.toContain("encrypted-native-child-prompt");
  });

  test("native acceptance is role-neutral and requires one correlated agent", () => {
    const payloads = [
      {
        type: "function_call",
        namespace: "collaboration",
        name: "spawn_agent",
        call_id: "delivery-call",
        arguments: JSON.stringify({
          task_name: "delivery",
          model: "gpt-5.6-luna",
          reasoning_effort: "low",
          fork_turns: "none",
          message: "encrypted-private-contract",
        }),
      },
      {
        type: "item_completed",
        item: {
          type: "SubAgentActivity",
          id: "delivery-call",
          kind: "started",
          agent_thread_id: "delivery-thread",
          agent_path: "/root/delivery",
        },
      },
      {
        type: "function_call_output",
        call_id: "delivery-call",
        output: JSON.stringify({ task_name: "/root/delivery" }),
      },
      {
        type: "function_call",
        namespace: "collaboration",
        name: "wait_agent",
        call_id: "wait-call",
        arguments: "{}",
      },
    ];
    const session = (items: object[] = payloads) =>
      items
        .map((payload, i) => JSON.stringify({ ordinal: i + 1, payload }))
        .join("\n");
    const proof = (
      input: string,
      boundary = "",
      expectedFollowUpPrompt?: string,
    ) =>
      retainedCodexEvidence(boundary, REPO, {
        exitCode: 0,
        stderrPresent: false,
        nativeSession: input,
        expectedFollowUpPrompt,
      });
    const accepted = "darrow.codex_native_single_agent_accepted";
    const parentWork = "darrow.codex_native_parent_tool_after_agent";
    expect(proof(session())).toContain(accepted);
    expect(proof(session())).not.toContain('"status":"unaccepted"');
    expect(proof(session())).toContain('"role":"unverified"');
    expect(proof(session())).not.toContain("encrypted-private-contract");
    expect(proof(session())).not.toContain("darrow.goal_owner_accepted");
    expect(proof(session())).not.toContain(parentWork);
    for (const broken of [
      payloads.slice(0, 2),
      [...payloads, payloads[2]!],
      [payloads[1]!, payloads[0]!, ...payloads.slice(2)],
      [...payloads, payloads[0]!],
      [
        payloads[0]!,
        payloads[1]!,
        { ...payloads[2], output: '{"task_name":"/root/other"}' },
      ],
    ])
      expect(proof(session(broken))).not.toContain(accepted);
    expect(proof(session() + "\nmalformed")).not.toContain(accepted);
    const work = [
      ...payloads,
      {
        type: "custom_tool_call",
        namespace: "functions",
        name: "exec",
        input: "private shell command",
      },
    ];
    expect(proof(session(work))).toContain(parentWork);
    expect(proof(session(work))).not.toContain("private shell command");
    const feedback = {
      type: "function_call",
      namespace: "collaboration",
      name: "followup_task",
      arguments: '{"target":"/root/delivery","message":"private"}',
    };
    expect(proof(session([...payloads, feedback]))).not.toContain(parentWork);
    const delivered = [
      ...payloads,
      { ...feedback, call_id: "feedback-call" },
      {
        type: "function_call_output",
        call_id: "feedback-call",
        output: JSON.stringify({ task_name: "/root/delivery" }),
      },
    ];
    expect(proof(session(delivered))).toContain(
      '"type":"darrow.codex_native_feedback"',
    );
    expect(proof(session(delivered))).toContain('"response_observed":true');
    expect(proof(session(delivered))).toContain('"delivery":"unverified"');
    expect(proof(session(delivered))).toContain('"after_follow_up":false');
    const boundary = JSON.stringify({
      type: "darrow.eval.follow_up_turn",
      native_after_ordinal: 4,
    });
    const matchedFeedback = proof(session(delivered), boundary, "private");
    expect(matchedFeedback).toContain('"after_follow_up":true');
    expect(matchedFeedback).toContain('"message_matches_expected":true');
    expect(matchedFeedback).toContain('"message_contains_expected":true');
    expect(matchedFeedback).not.toContain('"message":"private"');
    expect(
      proof(session(delivered), boundary, "different private feedback"),
    ).toContain('"message_matches_expected":false');
    const wrappedFeedback = [
      ...delivered.slice(0, -2),
      {
        ...feedback,
        call_id: "feedback-call",
        arguments:
          '{"target":"/root/delivery","message":"prefix private suffix"}',
      },
      delivered.at(-1)!,
    ];
    const wrappedProof = proof(session(wrappedFeedback), boundary, "private");
    expect(wrappedProof).toContain('"message_matches_expected":false');
    expect(wrappedProof).toContain('"message_contains_expected":true');
    for (const message of ["gAAAAABencrypted-feedback-token", undefined, 42]) {
      const raw = proof(
        session([
          ...delivered.slice(0, -2),
          {
            ...feedback,
            call_id: "feedback-call",
            arguments: JSON.stringify({ target: "/root/delivery", message }),
          },
          delivered.at(-1)!,
        ]),
        boundary,
        "private",
      );
      expect(raw).toContain('"message_matches_expected":null');
      expect(raw).toContain('"message_contains_expected":null');
      expect(raw).not.toContain("encrypted-feedback-token");
    }
    const relativeTarget = proof(
      session([
        ...delivered.slice(0, -2),
        {
          ...feedback,
          call_id: "feedback-call",
          arguments: '{"target":"delivery","message":"private"}',
        },
        delivered.at(-1)!,
      ]),
      boundary,
      "private",
    );
    expect(relativeTarget).toContain('"same_owner":true');
    expect(relativeTarget).not.toContain(parentWork);
    for (const output of [
      '{"error":"agent missing"}',
      "Tool failed",
      '{"task_name":"/root/other"}',
    ]) {
      const raw = proof(
        session([...delivered.slice(0, -1), { ...delivered.at(-1), output }]),
        boundary,
      );
      expect(raw).toContain('"delivery":"unverified"');
      expect(raw).not.toContain('"delivery":"verified"');
    }
    expect(
      proof(
        session(delivered),
        JSON.stringify({
          type: "darrow.eval.follow_up_turn",
          native_after_ordinal: 6,
        }),
      ),
    ).toContain('"after_follow_up":false');
    expect(proof(session(delivered))).not.toContain('"message":"private"');
    expect(proof(session(delivered.slice(0, -1)))).toContain(
      '"response_observed":false',
    );
    expect(proof(session([...delivered, delivered.at(-1)!]))).toContain(
      '"response_observed":false',
    );
    expect(
      proof(session([...payloads, { ...feedback, name: "send_message" }])),
    ).not.toContain(parentWork);
    expect(
      proof(
        session([
          ...payloads,
          { ...feedback, arguments: '{"target":"/root/other"}' },
        ]),
      ),
    ).toContain(parentWork);
  });

  test("assembles thread-bound native evidence into the retained transcript", async () => {
    const configRoot = await mkdtemp(join(tmpdir(), "darrow-codex-session-"));
    try {
      const threadId = "01a04f35-c37a-74b3-baa4-961bc21b6f49";
      const sessionRoot = join(configRoot, "sessions", "2026", "09", "06");
      await mkdir(sessionRoot, { recursive: true });
      const entry = (ordinal: number, payload: Record<string, unknown>) =>
        JSON.stringify({
          timestamp: `2026-09-06T10:00:0${ordinal}.000Z`,
          ordinal,
          type: "response_item",
          payload,
        });
      await writeFile(
        join(sessionRoot, `rollout-2026-09-06T10-00-00-${threadId}.jsonl`),
        [
          entry(1, {
            type: "function_call",
            name: "spawn_agent",
            namespace: "collaboration",
            call_id: "call-standards",
            arguments: JSON.stringify({
              task_name: "review_standards",
              fork_turns: "none",
              model: "gpt-5.6-sol",
              reasoning_effort: "xhigh",
              message: "- review_axis: standards\nsensitive review packet",
            }),
          }),
          entry(2, {
            type: "item_completed",
            item: {
              type: "SubAgentActivity",
              id: "call-standards",
              kind: "started",
              agent_thread_id: threadId,
              agent_path: "/root/review_standards",
            },
          }),
          entry(3, {
            type: "function_call_output",
            call_id: "call-standards",
            output: JSON.stringify({ task_name: "/root/review_standards" }),
          }),
        ].join("\n"),
      );
      const stream = [
        JSON.stringify({ type: "thread.started", thread_id: threadId }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n");
      const retained = await retainedCodexEvidenceForThread(
        stream,
        REPO,
        configRoot,
      );
      expect(retained).toContain('"type":"darrow.codex_native_spawn"');
      expect(retained).toContain('"status":"accepted"');
      expect(retained).not.toContain("sensitive review packet");
    } finally {
      await rm(configRoot, { recursive: true, force: true });
    }
  });

  test("recovers supporting skill reads from an accepted child native session", async () => {
    const repoDir = await mkdtemp(join(tmpdir(), "darrow-codex-skills-"));
    const configRoot = await mkdtemp(join(tmpdir(), "darrow-codex-session-"));
    try {
      const parentThread = "01a04f35-c37a-74b3-baa4-961bc21b6f49";
      const childThread = "01a04f35-c37a-74b3-baa4-961bc21b6f50";
      const skillsRoot = join(repoDir, ".agents", "skills");
      const primaryBody =
        "---\nname: adaptive-goal\ndescription: Primary fixture skill\n---\n\n# Adaptive goal\n";
      const supportingBody =
        "---\nname: create-pr\ndescription: Sensitive supporting fixture skill\n---\n\n# Create PR\n";
      await mkdir(join(skillsRoot, "adaptive-goal"), { recursive: true });
      await mkdir(join(skillsRoot, "create-pr"), { recursive: true });
      await writeFile(
        join(skillsRoot, "adaptive-goal", "SKILL.md"),
        primaryBody,
      );
      await writeFile(
        join(skillsRoot, "create-pr", "SKILL.md"),
        supportingBody,
      );

      const sessionRoot = join(configRoot, "sessions", "2026", "09", "06");
      await mkdir(sessionRoot, { recursive: true });
      const entry = (ordinal: number, payload: Record<string, unknown>) =>
        JSON.stringify({ ordinal, payload });
      await writeFile(
        join(sessionRoot, `rollout-2026-09-06T10-00-00-${parentThread}.jsonl`),
        [
          entry(1, {
            type: "function_call",
            name: "spawn_agent",
            namespace: "collaboration",
            call_id: "call-owner",
            arguments: JSON.stringify({
              task_name: "adaptive_owner",
              fork_turns: "none",
              model: "gpt-5.6-terra",
              reasoning_effort: "medium",
              message: "sensitive owner contract",
            }),
          }),
          entry(2, {
            type: "item_completed",
            item: {
              type: "SubAgentActivity",
              id: "call-owner",
              kind: "started",
              agent_thread_id: childThread,
              agent_path: "/root/adaptive_owner",
            },
          }),
          entry(3, {
            type: "function_call_output",
            call_id: "call-owner",
            output: JSON.stringify({ task_name: "/root/adaptive_owner" }),
          }),
        ].join("\n"),
      );
      await writeFile(
        join(sessionRoot, `rollout-2026-09-06T10-00-01-${childThread}.jsonl`),
        entry(1, {
          type: "item_completed",
          item: {
            type: "CommandExecution",
            command: [
              "/bin/zsh",
              "-lc",
              `sed -n '1,200p' ${join(skillsRoot, "create-pr", "SKILL.md")}`,
            ],
            aggregated_output: supportingBody,
            exit_code: 0,
            status: "completed",
          },
        }),
      );

      const stream = [
        JSON.stringify({ type: "thread.started", thread_id: parentThread }),
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "command_execution",
            command: `cat ${join(skillsRoot, "adaptive-goal", "SKILL.md")}`,
            aggregated_output: primaryBody,
            exit_code: 0,
            status: "completed",
          },
        }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n");

      const retained = await retainedCodexEvidenceForThread(
        stream,
        repoDir,
        configRoot,
        { installedSkillsRoot: skillsRoot },
      );
      expect(retained).toContain('"skill":"adaptive-goal"');
      expect(retained).toContain('"skill":"create-pr"');
      expect(retained.indexOf('"skill":"adaptive-goal"')).toBeLessThan(
        retained.indexOf('"skill":"create-pr"'),
      );
      expect(retained).not.toContain("Sensitive supporting fixture skill");
      expect(retained).not.toContain("sensitive owner contract");
    } finally {
      await rm(repoDir, { recursive: true, force: true });
      await rm(configRoot, { recursive: true, force: true });
    }
  });

  test("retains no accepted launch from a malformed native session", () => {
    const retained = retainedCodexEvidence(
      JSON.stringify({ type: "turn.completed" }),
      REPO,
      {
        exitCode: 0,
        stderrPresent: false,
        nativeSession: "not-json\n",
      },
    );
    expect(retained).toContain(
      '"type":"darrow.codex_native_session_malformed"',
    );
    expect(retained).not.toContain('"type":"darrow.codex_native_spawn"');
  });

  test("retains earlier spawn attempts when a later native entry is malformed", () => {
    const nativeSession = [
      JSON.stringify({
        timestamp: "2026-09-06T10:00:01.000Z",
        ordinal: 1,
        type: "response_item",
        payload: {
          type: "function_call",
          name: "spawn_agent",
          namespace: "collaboration",
          call_id: "call-standards",
          arguments: JSON.stringify({
            task_name: "review_standards",
            fork_turns: "none",
            model: "gpt-5.6-sol",
            reasoning_effort: "xhigh",
            message: "gAAAAABsensitive-encrypted-prompt",
          }),
        },
      }),
      "not-json",
    ].join("\n");
    const retained = retainedCodexEvidence(
      JSON.stringify({ type: "turn.completed" }),
      REPO,
      { exitCode: 0, stderrPresent: false, nativeSession },
    );
    expect(retained).toContain(
      '"type":"darrow.codex_native_session_malformed"',
    );
    expect(retained).toContain('"type":"darrow.codex_native_spawn"');
    expect(retained).toContain('"status":"unaccepted"');
    expect(retained).not.toContain("sensitive-encrypted-prompt");
  });

  test("does not accept a native spawn with ambiguous returned child IDs", () => {
    const nativeEntry = (ordinal: number, payload: Record<string, unknown>) =>
      JSON.stringify({
        timestamp: `2026-09-06T10:00:0${ordinal}.000Z`,
        ordinal,
        type: "response_item",
        payload,
      });
    const nativeSession = [
      nativeEntry(1, {
        type: "function_call",
        name: "spawn_agent",
        namespace: "collaboration",
        call_id: "call-standards",
        arguments: JSON.stringify({
          task_name: "review_standards",
          fork_turns: "none",
          model: "gpt-5.6-sol",
          reasoning_effort: "xhigh",
          message: "gAAAAABsensitive-encrypted-prompt",
        }),
      }),
      nativeEntry(2, {
        type: "item_completed",
        item: {
          type: "SubAgentActivity",
          id: "call-standards",
          kind: "started",
          agent_thread_id: "01a04f35-c37a-74b3-baa4-961bc21b6f49",
          agent_path: "/root/review_standards",
        },
      }),
      nativeEntry(3, {
        type: "function_call_output",
        call_id: "call-standards",
        output: JSON.stringify({ task_name: "/root/review_standards" }),
      }),
      nativeEntry(4, {
        type: "function_call_output",
        call_id: "call-standards",
        output: JSON.stringify({ task_name: "/root/another_child" }),
      }),
    ].join("\n");
    const retained = retainedCodexEvidence(
      JSON.stringify({ type: "turn.completed" }),
      REPO,
      { exitCode: 0, stderrPresent: false, nativeSession },
    );
    expect(retained).toContain('"type":"darrow.codex_native_spawn"');
    expect(retained).toContain('"status":"unaccepted"');
    expect(retained).not.toContain('"status":"accepted"');
    expect(retained).not.toContain("sensitive-encrypted-prompt");
  });

  test("retains an ineligible native spawn without exposing its prompt", () => {
    const nativeSession = JSON.stringify({
      timestamp: "2026-09-06T10:00:01.000Z",
      ordinal: 1,
      type: "response_item",
      payload: {
        type: "function_call",
        name: "spawn_agent",
        namespace: "collaboration",
        call_id: "call-generic",
        arguments: JSON.stringify({
          task_name: "generic_reviewer",
          fork_turns: "none",
          model: "gpt-5.6-sol",
          reasoning_effort: "xhigh",
          message: "gAAAAABsensitive-encrypted-prompt",
        }),
      },
    });
    const retained = retainedCodexEvidence(
      JSON.stringify({ type: "turn.completed" }),
      REPO,
      { exitCode: 0, stderrPresent: false, nativeSession },
    );
    expect(retained).toContain('"type":"darrow.codex_native_spawn"');
    expect(retained).toContain('"status":"unaccepted"');
    expect(retained).toContain('"reasons":["review_axis"]');
    expect(retained).not.toContain("sensitive-encrypted-prompt");
  });

  test("does not mark a started-only review launch as accepted", () => {
    const childId = "01a04f35-c37a-74b3-baa4-961bc21b6f49";
    const stream = [
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "in_progress",
          receiver_thread_ids: [childId],
          task_name: "review_standards",
          model: "gpt-5.6-sol",
          reasoning_effort: "xhigh",
          fork_turns: "none",
          prompt: "- review_axis: standards\nsecret body",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    const retained = retainedCodexEvidence(stream, REPO);
    expect(retained).toContain('"event_type":"item.started"');
    expect(retained).not.toContain('"launch_accepted":true');
    expect(retained).not.toContain("secret body");
  });

  test("omits hostile and unbounded collaboration identifiers", () => {
    const stream = [
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "wait_agent",
          status: "in_progress",
          sender_thread_id: `parent-${"x".repeat(256)}`,
          receiver_thread_ids: ["child\nsecret"],
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    const retained = retainedCodexEvidence(stream, REPO);
    expect(retained).toContain('"tool":"wait_agent"');
    expect(retained).not.toContain("sender_thread_id");
    expect(retained).not.toContain("receiver_thread_ids");
    expect(retained).not.toContain("secret");
  });

  test("retains a bounded reason when a native launch is rejected", () => {
    const stream = [
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "in_progress",
          receiver_thread_ids: ["child-1", "child-2"],
          task_name: "Sensitive review title",
          prompt: "- review_axis: standards\nsecret body",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    const retained = retainedCodexEvidence(stream, REPO);
    expect(retained).toContain('"type":"darrow.collaboration_launch_rejected"');
    expect(retained).toContain('"reasons":["agent_reference"]');
    expect(retained).toContain('"task_name_class":"invalid"');
    expect(retained).toContain('"receiver_count":2');
    expect(retained).toContain('"item_keys"');
    expect(retained).not.toContain("Sensitive review title");
    expect(retained).not.toContain("secret body");
  });

  test("distinguishes authorized staging from executed parent verification", () => {
    const staging = JSON.stringify({
      type: "item.started",
      item: { id: "stage", type: "file_change", status: "in_progress" },
    });
    const command = (
      exitCode: number,
      status: "completed" | "failed",
      text = "bash test.sh",
    ) =>
      JSON.stringify({
        type: "item.completed",
        item: {
          id: "test",
          type: "command_execution",
          command: text,
          exit_code: exitCode,
          status,
          aggregated_output: "",
        },
      });
    expect(retainedCodexEvidence(staging, REPO)).not.toContain(
      "darrow.parent_tool_before_goal",
    );
    expect(retainedCodexEvidence(command(0, "completed"), REPO)).toContain(
      '"type":"darrow.parent_tool_before_goal","operation":"verification"',
    );
    expect(retainedCodexEvidence(command(1, "failed"), REPO)).toContain(
      "darrow.parent_tool_before_goal",
    );
    for (const read of [
      "cat test.sh",
      "sed -n '1,80p' test.sh",
      "printf '%s' 'bash test.sh'",
    ]) {
      expect(
        retainedCodexEvidence(command(0, "completed", read), REPO),
      ).not.toContain("darrow.parent_tool_before_goal");
    }
  });

  test("retains one verified inline owner boundary and post-owner evidence", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-codex-adapter-"));
    const ownerId = "01a04f35-c37a-74b3-baa4-961bc21b6f49";
    const objectiveRoot = await mkdtemp(
      join(tmpdir(), "darrow-codex-objective-"),
    );
    try {
      await writeFile(join(repo, "fixture.txt"), "base\n");
      await mkdir(join(repo, ".git"));
      const policy = {
        secret: "secret",
        baselineSha256: await repositoryFingerprint(repo),
        fixtureStateSha256: await fixtureStateFingerprint(repo),
        requestSha256: "4".repeat(64),
        objectiveRoot,
        goalLoopPath: "/plugin/bin/goal-loop",
        statePath: join(repo, ".git", "guard-state"),
      };
      const hook = {
        hook_event_name: "PreToolUse",
        tool_use_id: "owner-tool-use",
        turn_id: "parent-turn",
        cwd: repo,
        tool_name: "Agent",
        tool_input: {
          task_name: "adaptive_goal_fixture",
          message: "- phase: adaptive-goal-owner\n" + COMPLETE_CONTRACT,
          model: "gpt-5.6-luna",
          reasoning_effort: "low",
          fork_turns: "none",
        },
      };
      const guarded = await guardCodexSpawn(hook, policy);
      const prompt = (
        guarded?.hookSpecificOutput as {
          updatedInput: { message: string };
        }
      ).updatedInput.message;
      const acceptedOwner = await verifiedCodexAcceptedOwner(
        policy.statePath,
        policy.secret,
        ownerId,
      );

      const spawnItem = {
        id: "spawn-1",
        type: "collab_tool_call",
        tool: "spawn_agent",
        status: "completed",
        sender_thread_id: "parent-thread",
        receiver_thread_ids: [ownerId],
        prompt,
      };
      const stream = [
        JSON.stringify({ type: "item.completed", item: spawnItem }),
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "wait-1",
            type: "collab_tool_call",
            tool: "wait_agent",
            status: "completed",
            receiver_thread_ids: [ownerId],
          },
        }),
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "non-tool-error",
            type: "error",
            message: "transient host notice",
          },
        }),
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "parent-command",
            type: "command_execution",
            command: "bash test.sh",
            exit_code: 0,
            status: "completed",
            aggregated_output: "",
          },
        }),
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "feedback-answer",
            type: "command_execution",
            command: "feedbackctl answer rounding-mode",
            exit_code: 0,
            status: "completed",
            aggregated_output: "nearest\n",
          },
        }),
      ].join("\n");
      const retained = retainedCodexEvidence(stream, repo, {
        exitCode: 0,
        stderrPresent: false,
        spawnGuardSecret: "secret",
        acceptedAgentRef: ownerId,
        acceptedOwner,
      });
      expect(retained).toContain("- phase: adaptive-goal-owner");
      expect(retained).toContain('"tool":"wait_agent"');
      expect(retained).toContain('"type":"darrow.parent_tool_after_goal"');
      expect(retained.match(/darrow\.parent_tool_after_goal/g)).toHaveLength(1);
      expect(retained).toContain('"type":"darrow.human_feedback_answer"');
      expect(retained).not.toContain("goal_spawn_attestation");
      expect(retained).toContain('"type":"darrow.goal_owner_accepted"');
      expect(retained).toContain('"model":"gpt-5.6-luna"');
      expect(retained).not.toContain(
        "Implement the requested fixture behavior",
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
  });

  test("keeps same-owner feedback bound to the accepted owner", () => {
    const owner = "/root/adaptive_goal_fixture";
    const collaboration = (
      tool: "spawn_agent" | "wait_agent" | "followup_task",
      receiver: string,
    ) =>
      JSON.stringify({
        type: "item.completed",
        item: {
          id: tool + "-" + receiver,
          type: "collab_tool_call",
          tool,
          status: "completed",
          receiver_thread_ids: [receiver],
          task_name: tool === "spawn_agent" ? receiver : undefined,
          prompt:
            tool === "spawn_agent" ? "- phase: adaptive-goal-owner" : undefined,
        },
      });
    const retained = retainedCodexEvidence(
      [
        collaboration("spawn_agent", owner),
        collaboration("wait_agent", owner),
        collaboration("followup_task", owner),
        collaboration("followup_task", "/root/replacement_owner"),
      ].join("\n"),
      REPO,
      {
        exitCode: 0,
        stderrPresent: false,
        acceptedAgentRef: owner,
      },
    );
    expect(retained).toContain('"tool":"wait_agent"');
    expect(retained).toContain('"tool":"followup_task"');
    expect(retained).not.toContain("/root/replacement_owner");
    expect(retained.match(/darrow\.parent_tool_after_goal/g)).toHaveLength(1);
  });

  test("retains an opaque replacement spawn after owner acceptance", () => {
    const owner = "/root/adaptive_goal_fixture";
    const replacement = "/root/replacement_owner";
    const collaboration = (receiver: string, prompt: string, sender: string) =>
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "completed",
          sender_thread_id: sender,
          receiver_thread_ids: [receiver],
          task_name: receiver,
          prompt,
        },
      });
    const retained = retainedCodexEvidence(
      [
        collaboration(owner, "- phase: adaptive-goal-owner", "/root/parent"),
        collaboration(
          replacement,
          "unmarked replacement task",
          "/root/parent_followup",
        ),
      ].join("\n"),
      REPO,
      {
        exitCode: 0,
        stderrPresent: false,
        acceptedAgentRef: owner,
      },
    );
    expect(retained).toContain('"type":"darrow.parent_spawn_after_goal"');
    expect(retained).toContain('"tool":"spawn_agent"');
    expect(retained).toContain('"sender_thread_id":"/root/parent_followup"');
    expect(retained).toContain(`"agent_ref":"${replacement}"`);
    expect(retained).not.toContain("unmarked replacement task");
  });

  test("retains a failed native spawn attempt as omission evidence", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "failed",
          prompt: "- review_axis: standards\nsensitive failed task",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    const retained = retainedCodexEvidence(stream, REPO);
    expect(retained).toContain('"tool":"spawn_agent"');
    expect(retained).toContain('"status":"failed"');
    expect(retained).toContain("- review_axis: standards");
    expect(retained).not.toContain("sensitive failed task");
  });
});
