import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { runChecks } from "./checks";
import type { Check, EvalCase } from "./types";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function messageChecks(
  relativeCasePath: string,
  message: string,
  names: string[],
) {
  const root = await mkdtemp(join(tmpdir(), "darrow-discovery-checks-"));
  roots.push(root);
  await mkdir(join(root, ".git"));
  await writeFile(join(root, ".git", "last-message.md"), message);
  const evalCase = parseYaml(
    await readFile(
      resolve(import.meta.dir, "..", "..", relativeCasePath),
      "utf8",
    ),
  ) as EvalCase;
  const checks = evalCase.checks.filter((check) => names.includes(check.name));
  return runChecks(root, checks as Check[]);
}

describe("discovery eval loopholes", () => {
  test("subjectless grilling accepts only the canonical question", async () => {
    const path =
      "plugins/capability/darrow-discovery/skills/grilling/evals/incomplete-subject.yaml";
    const name = "response is exactly the canonical subject question";
    for (const message of [
      "What subject would you like me to grill?\n\nHappy to help.",
      "What topic would you like grilled?\n\nQ3 — What scale?",
      "What plan should I grill?\n\n- Who uses it?\n- What scale is expected?",
      "What topic should I grill?\nWhat outcome matters?",
      "What topic should I grill? Also, what outcome matters?",
      "What topic should I grill?\n\n+ Who uses it?\n+ What scale?",
      "What topic should I grill—and what outcome matters?",
      "What topic should I grill?\nWhat outcome matters?",
      "Which plan and what outcome should I grill?",
      "What topic should I grill? Also, should I consider a desired outcome?",
      "Which topic should I grill: payments, authentication, or storage?",
      "Which topic should I grill — payments, authentication, or storage?",
      "Which topic should I grill (payments, authentication, or storage)?",
      "Which topic should I grill — payments or authentication?",
      "Which topic should I grill (payments or authentication)?",
      "What would you like me to grill — a plan, decision, design, or idea?",
      "What would you like me to grill — a plan or decision you're weighing? I need a concrete target.",
      "What subject do you want me to grill?",
      "What idea or plan would you like me to grill?",
      "- What topic should I grill?",
      "Is there a plan you would like grilled?",
      "Do you have a topic you'd like me to grill?",
      "What do you want grilled?",
      "On what?",
      "Which subject?",
      "What should we grill?",
      "What do you want grilled? Give me one concrete target.",
    ]) {
      const [check] = await messageChecks(path, message, [name]);
      expect(check?.passed).toBe(false);
    }

    const [canonical] = await messageChecks(
      path,
      "What subject would you like me to grill?",
      [name],
    );
    expect(canonical?.passed).toBe(true);
  });

  test("unresolved planning rejects a premature compatibility question", async () => {
    for (const question of [
      "Q2 — What compatibility strategy should apply during rollout?",
      "Q2 — Compatibility strategy during rollout?",
      "Q2 — Describe the compatibility strategy for rollout?",
      "Q2 — Should existing callers retain the 1000 ms fallback during rollout?",
      "Q2 — What migration policy should preserve existing request behavior?",
      "Q2 — Should DEFAULT_TIMEOUT_MS remain the default for legacy callers?",
      "Q2 — What rollout strategy should we use for\nbackward compatibility?",
      "2. What compatibility strategy should apply?",
      "**Q2** — What compatibility strategy should apply?",
      "Q2) What compatibility strategy should apply?",
      "Q02 — What compatibility strategy should apply?",
    ]) {
      const [check] = await messageChecks(
        "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
        [
          "Q1 — Should the timeout be process-wide or per request?",
          "Recommendation: Prefer per-request configuration.",
          question,
        ].join("\n"),
        ["dependent choices are neither asked nor selected prematurely"],
      );
      expect(check?.passed).toBe(false);
    }
  });

  test("unresolved planning rejects an unnumbered dependent question", async () => {
    const [check] = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Q1 — Should the timeout be process-wide or per request?",
        "Recommendation: Prefer per-request configuration.",
        "Should existing callers retain the 1000 ms fallback during rollout?",
      ].join("\n"),
      ["dependent choices are neither asked nor selected prematurely"],
    );
    expect(check?.passed).toBe(false);
  });

  test("unresolved planning rejects dependent selections inside the root recommendation", async () => {
    for (const recommendation of [
      "Choose both, preserve 1000ms as the default, and add request(url, { timeoutMs }).",
      "Choose both, with per-request configuration taking precedence over process-wide configuration.",
      "Choose per-request configuration while preserving the existing default behavior.",
      "Choose both; request-specific values win over the global setting.",
      "Choose both; an explicit value on a call takes effect instead of the shared setting.",
      "Choose process-wide because there is no options parameter, preserving request(url) unchanged for existing callers.",
      "Choose process-wide because the repository currently uses a single shared constant, so process-wide is the smallest change consistent with how the codebase already models configuration.",
      "Choose process-wide because the library today has one homogeneous request surface with a single call site, so one shared setting matches the current shape of the library.",
    ]) {
      const [check] = await messageChecks(
        "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
        [
          "Q1 — Should the timeout be process-wide or per request?",
          `Recommendation: ${recommendation}`,
          "Compatibility and migration questions are deferred.",
        ].join("\n"),
        ["dependent choices are neither asked nor selected prematurely"],
      );
      expect({ recommendation, passed: check?.passed }).toEqual({
        recommendation,
        passed: false,
      });
    }
  });

  test("unresolved planning requires the scope choice as the only root", async () => {
    const names = [
      "unresolved architecture uses a grilling round",
      "dependent choices are neither asked nor selected prematurely",
    ];
    const wrongRoot = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Q1 — Rollout: Should existing callers migrate in one release?",
        "Recommendation: Prefer per-request configuration.",
        "The repository uses DEFAULT_TIMEOUT_MS = 1000.",
      ].join("\n"),
      names,
    );
    expect(wrongRoot.map((check) => check.passed)).toEqual([false, false]);

    const delayedChild = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Q1 — Configuration scope: Should configuration be process-wide or per-request?",
        "Recommendation: Prefer per-request scope because it avoids shared state.",
        "Evidence: DEFAULT_TIMEOUT_MS is 1000.",
        "",
        "The existing default behavior will remain unchanged.",
      ].join("\n"),
      ["dependent choices are neither asked nor selected prematurely"],
    );
    expect(delayedChild[0]?.passed).toBe(false);

    const disguisedRoot = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Q1 — Rollout: Should migration differ between process-wide and per-request configuration?",
        "Recommendation: Prefer per-request scope because it avoids shared state.",
        "Deferred: API shape, default and validation semantics, compatibility, and migration. I will recompute the next frontier.",
      ].join("\n"),
      ["unresolved architecture uses a grilling round"],
    );
    expect(disguisedRoot[0]?.passed).toBe(false);
  });

  test("planning frontier ignores question punctuation inside an evidence URL", async () => {
    const results = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Evidence: https://example.test/client?version=current documents DEFAULT_TIMEOUT_MS.",
        "",
        "Q1 — Configuration scope: Should configuration be process-wide",
        "or per-request?",
        "",
        "Recommendation: Prefer per-request scope because it avoids shared state.",
        "",
        "Deferred: API shape, default and validation semantics, compatibility, and",
        "migration. I will recompute the next frontier.",
      ].join("\n"),
      [
        "unresolved architecture uses a grilling round",
        "technical recommendations preserve user choice",
        "dependent choices are neither asked nor selected prematurely",
        "deferred children and next frontier remain explicit",
      ],
    );
    expect(results.map((check) => check.passed)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  test("planning frontier accepts a scope root after evidence that the seam is absent", async () => {
    for (const evidence of [
      "Evidence: request(url) uses DEFAULT_TIMEOUT_MS = 1000; there is no per-call timeout parameter or override seam today.",
      "Evidence: request(url) has no options parameter; there is no per-call override or environment configuration anywhere in the repository.",
    ]) {
      const results = await messageChecks(
        "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
        [
          evidence,
          "",
          "**Q1 — Configuration scope: should the timeout be configurable process-wide or per-request?**",
          "",
          "Recommendation: **per-request** — it keeps timeout policy local to each request and avoids shared mutable state.",
          "",
          "Deferred: API shape, default and precedence semantics, validation, compatibility, and migration. After your answer, I will recompute the next frontier.",
        ].join("\n"),
        [
          "unresolved architecture uses a grilling round",
          "technical recommendations preserve user choice",
          "dependent choices are neither asked nor selected prematurely",
          "deferred children and next frontier remain explicit",
        ],
      );
      expect({
        evidence,
        passed: results.map((check) => check.passed),
      }).toEqual({
        evidence,
        passed: [true, true, true, true],
      });
    }
  });

  test("planning frontier does not invent a combined scope option", async () => {
    for (const response of [
      [
        "Q1 — Configuration scope: should timeout configuration be process-wide, per-request, or both?",
        "Recommendation: Choose both because it balances centralized control and local flexibility.",
      ],
      [
        "Q1 — Configuration scope: should timeout configuration be process-wide or per-request?",
        "Recommendation: both because it balances centralized control and local flexibility.",
      ],
    ]) {
      const [check] = await messageChecks(
        "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
        [
          "Evidence: DEFAULT_TIMEOUT_MS = 1000.",
          "",
          ...response,
          "",
          "Deferred: API shape, default and precedence semantics, validation, compatibility, and migration. After your answer, I will recompute the next frontier.",
        ].join("\n"),
        ["dependent choices are neither asked nor selected prematurely"],
      );
      expect({ response, passed: check?.passed }).toEqual({
        response,
        passed: false,
      });
    }
  });

  test("planning frontier requires one concrete root recommendation", async () => {
    for (const recommendation of [
      "Recommendation: I cannot recommend process-wide or per-request without your guidance.",
      "Recommendation: per-request because process-wide is harder to test.",
    ]) {
      const results = await messageChecks(
        "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
        [
          "Q1 — Configuration scope: should timeout configuration be process-wide or per-request?",
          recommendation,
        ].join("\n"),
        [
          "technical recommendations preserve user choice",
          "dependent choices are neither asked nor selected prematurely",
        ],
      );
      expect({
        recommendation,
        passed: results.map((check) => check.passed),
      }).toEqual({
        recommendation,
        passed: [false, false],
      });
    }
  });

  test("an absence fact cannot hide a child selection later in the same paragraph", async () => {
    const [check] = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Evidence: There is no current policy; use request(url, options) and let per-request override the shared setting.",
        "",
        "Q1 — Configuration scope: should timeout configuration be process-wide or per-request?",
        "Recommendation: per-request because needs vary by operation.",
      ].join("\n"),
      ["dependent choices are neither asked nor selected prematurely"],
    );
    expect(check?.passed).toBe(false);
  });

  test("planning frontier accepts compact factual context and Markdown labels", async () => {
    const results = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "I inspected the repository before framing the root decision.",
        "",
        "**What exists today:** `request(url)` uses `DEFAULT_TIMEOUT_MS = 1000`; there are no environment variables, config files, or options object in the repository.",
        "",
        "**Q1 — Configuration scope: should the request timeout be configurable process-wide or per-request?**",
        "",
        "- **process-wide**",
        "- **per-request**",
        "",
        "**Recommendation: per-request.** Different operations can need different limits, and no shared policy authority exists to govern every call.",
        "",
        "**Deferred:** API shape, default and precedence semantics, validation, compatibility, and migration. After your answer, I will recompute the next frontier.",
      ].join("\n"),
      [
        "unresolved architecture uses a grilling round",
        "technical recommendations preserve user choice",
        "dependent choices are neither asked nor selected prematurely",
        "deferred children and next frontier remain explicit",
      ],
    );
    expect(results.map((check) => check.passed)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  test("root rationale may describe present evidence and locality without preserving a default", async () => {
    const [check] = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Evidence: `request(url)` uses `DEFAULT_TIMEOUT_MS = 1000` today.",
        "",
        "Q1 — Configuration scope: should the request timeout be configurable process-wide or per-request?",
        "",
        "Recommendation: per-request because nothing establishes shared policy authority today; it keeps the timeout local to each call and avoids shared mutable state.",
        "",
        "Deferred: API shape, default and precedence semantics, validation, compatibility, and migration. After your answer, I will recompute the next frontier.",
      ].join("\n"),
      ["dependent choices are neither asked nor selected prematurely"],
    );
    expect(check?.passed).toBe(true);
  });

  test("root rationale may contrast locality with introducing shared mutable state", async () => {
    const [check] = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Evidence: `request(url)` uses `DEFAULT_TIMEOUT_MS = 1000`; there is no options object or runtime config surface today.",
        "",
        "Q1 — Timeout configuration scope: process-wide or per-request?",
        "",
        "Recommendation: per-request because different calls can need different limits; it keeps that flexibility local instead of introducing shared mutable state.",
        "",
        "Deferred: API shape, default and precedence semantics, validation, compatibility, and migration. After your answer, I will recompute the next frontier.",
      ].join("\n"),
      ["dependent choices are neither asked nor selected prematurely"],
    );
    expect(check?.passed).toBe(true);
  });

  test("unresolved planning rejects a promise to draft after only the root answer", async () => {
    const [check] = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Q1 — Should the timeout be process-wide or per request?",
        "Recommendation: Prefer per-request configuration.",
        "API shape, validation, compatibility, and migration are deferred.",
        "Once you confirm this scope, I can draft the implementation plan.",
      ].join("\n"),
      ["unresolved choices do not become or promise a final plan"],
    );
    expect(check?.passed).toBe(false);
  });

  test("unresolved planning requires explicit deferred children and frontier recomputation", async () => {
    const results = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Evidence: request(url) uses DEFAULT_TIMEOUT_MS = 1000.",
        "Q1 — Configuration scope: Should configuration be process-wide or per-request?",
        "Recommendation: Prefer per-request scope because it avoids shared state.",
      ].join("\n"),
      ["deferred children and next frontier remain explicit"],
    );
    expect(results[0]?.passed).toBe(false);
  });

  test("unresolved planning accepts equivalent deferred categories in any order", async () => {
    for (const deferred of [
      "public interface, compatibility strategy, default behavior, validation policy, verification coverage",
      "public interface, compatibility strategy, validation semantics, verification coverage",
      "interface shape, default and fallback behavior, precedence rules, compatibility, migration and rollout",
    ]) {
      const [check] = await messageChecks(
        "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
        [
          "Evidence: request(url) uses DEFAULT_TIMEOUT_MS = 1000.",
          "Q1 — Configuration scope: Should configuration be process-wide or per-request?",
          "Recommendation: Prefer per-request scope because it avoids shared state.",
          `Deferred: ${deferred}. After your answer, I will recompute the next frontier.`,
        ].join("\n"),
        ["deferred children and next frontier remain explicit"],
      );
      expect({ deferred, passed: check?.passed }).toEqual({
        deferred,
        passed: true,
      });
    }
  });

  test("unresolved planning rejects a disguised action outline", async () => {
    const [check] = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Evidence: request(url) uses DEFAULT_TIMEOUT_MS = 1000.",
        "Q1 — Configuration scope: Should configuration be process-wide or per-request?",
        "Recommendation: Prefer per-request scope because it avoids shared state.",
        "Deferred: API shape, default and validation semantics, compatibility, and migration. I will recompute the next frontier.",
        "Work outline:",
        "- Extend the client interface.",
        "- Add coverage.",
      ].join("\n"),
      ["unresolved choices do not become or promise a final plan"],
    );
    expect(check?.passed).toBe(false);
  });

  test("planning frontier accepts harmless Markdown and first-person labels", async () => {
    for (const question of [
      "**Q1. Should timeout configuration be process-wide or per request?**",
      "**1. Should timeout configuration be process-wide or per request?**",
      "Q1 — Configuration scope: process-wide or per-request?",
      "**Q1 — Configuration scope: should the request timeout be configurable process-wide or per-request?**",
      "**Q1 — Configuration scope: should the configurable timeout be process-wide or per-request?**",
      "Q1 — Should the configurable timeout apply process-wide or per-request? (process-wide / per-request)",
      "**Q1 — Timeout configuration scope: process-wide or per-request?**",
      "Q1 — Scope: process-wide or per request?",
    ]) {
      const results = await messageChecks(
        "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
        [
          question,
          "**My recommendation:** Prefer per-request configuration.",
        ].join("\n"),
        [
          "unresolved architecture uses a grilling round",
          "technical recommendations preserve user choice",
        ],
      );
      expect(results.map((check) => check.passed)).toEqual([true, true]);
    }
  });

  test("unresolved planning rejects an implementation plan after a frontier", async () => {
    const names = [
      "unresolved architecture uses a grilling round",
      "technical recommendations preserve user choice",
      "repository facts are used",
      "unresolved choices do not become or promise a final plan",
    ];
    const results = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Q1 — Should the timeout be process-wide or per request?",
        "Recommendation: Prefer per-request configuration while preserving the current default.",
        "This follows src/config.js and DEFAULT_TIMEOUT_MS.",
        "",
        "## Implementation plan",
        "1. Add the option.",
      ].join("\n"),
      names,
    );
    expect(results.map((check) => check.passed)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  test("planning transfer does not turn missing repository policy into authority", async () => {
    const [check] = await messageChecks(
      "plugins/capability/darrow-discovery/skills/plan-implementation/evals/dependency-frontier-transfer.yaml",
      [
        "Evidence: No encryption or partitioning code exists. This is effectively a greenfield build.",
        "Q1 — Storage topology: shared archive or tenant-isolated stores?",
        "Recommendation: Choose shared archive because no repository evidence indicates a regulatory isolation requirement.",
        "Deferred: encryption-key ownership, partition format, migration strategy. I will recompute the next frontier.",
      ].join("\n"),
      ["repository absence is not promoted to greenfield authority"],
    );
    expect(check?.passed).toBe(false);
  });
});
