# Workflow Opportunities from Matt Pocock's Skills

Status: exploratory research, not an accepted decision or implementation plan  
Reviewed: 2026-08-07  
Source: [mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills)

## Purpose

This note preserves practices and skill ideas from Matt Pocock's skills
repository that could meaningfully extend Darrow. It records opportunities for
later evaluation; it does not authorize a new plugin, select final names, or
change the boundaries of the existing goal loop and ticket pipeline.

The strongest opportunities sit around execution rather than introducing
another execution runtime:

```text
idea --> discovery --> bounded goal
                 \--> work plan --> tickets --> ticket pipeline

bug  --> diagnosis --> TDD or bounded goal
```

## Recommended opportunities

### 1. Discovery and structured interviewing

The highest-value addition is a standalone discovery capability, provisionally
called `darrow-discovery`. It would sharpen an idea before execution without
becoming another goal or ticket controller.

Start with one explicitly invoked skill, provisionally `interview-design`:

- model the discussion as a decision tree;
- ask questions in rounds from the current frontier, where prerequisites are
  already settled;
- give a recommended answer and rationale with each question;
- investigate repository and external facts rather than asking the user for
  discoverable information;
- distinguish resolved choices, open branches, assumptions, and evidence; and
- stop without implementing until the user confirms shared understanding.

The default result should be a compact discovery brief in the conversation.
It should not edit product files, create tickets, or treat recommendations as
accepted decisions.

Possible later skills in the same uncertainty-resolution family:

- `research-question` investigates one question through primary sources and
  preserves cited evidence without converting it into a decision.
- `prototype-question` creates explicitly throwaway code to answer one visual,
  behavioral, or state-model question, then records the verdict separately
  from the disposable artifact.
- `prepare-questionnaire` creates an asynchronous questionnaire when the
  missing knowledge belongs to another person rather than the current user.
- `model-domain` challenges ambiguous terminology, stress-tests it with
  concrete scenarios, and maintains the repository's existing canonical
  glossary when one exists.

Darrow should adapt the method without imposing a universal `CONTEXT.md`
layout. Accepted choices remain owned by the repository's canonical decision
surface and the `darrow-decisions` capability; discovery produces evidence and
proposals, not authority.

Relevant upstream skills:

- [`grilling`](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md)
- [`domain-modeling`](https://github.com/mattpocock/skills/blob/main/skills/engineering/domain-modeling/SKILL.md)
- [`research`](https://github.com/mattpocock/skills/blob/main/skills/engineering/research/SKILL.md)
- [`prototype`](https://github.com/mattpocock/skills/blob/main/skills/engineering/prototype/SKILL.md)
- [`to-questionnaire`](https://github.com/mattpocock/skills/blob/main/skills/productivity/to-questionnaire/SKILL.md)

### 2. Disciplined bug diagnosis

A separate `darrow-debugging` plugin with a `diagnose-bug` skill would fill a
clear gap between observing a failure and implementing a known fix.

The core sequence should be:

1. Construct one tight command that can reproduce the user's exact symptom.
2. Minimize the reproduction until every remaining input or step is
   load-bearing.
3. Generate several ranked, falsifiable hypotheses before investigating one.
4. Instrument one prediction at a time and preserve redacted evidence.
5. Establish and report the root cause.
6. Remove temporary instrumentation and artifacts.
7. When repair was explicitly requested, hand the proven reproduction and
   root-cause evidence to a test-first implementation path.

This complements `darrow-tdd`: diagnosis discovers why an unclear failure
occurs; TDD implements a known observable change through a durable public seam.
Diagnosis should remain report-only unless the user also authorizes a fix.

Relevant upstream skill:
[`diagnosing-bugs`](https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md).

### 3. Work shaping between discovery and delivery

A provisional `darrow-work-planning` capability could bridge a resolved design
to multiple independently deliverable tickets:

- `synthesize-spec` turns an already-resolved conversation into a durable
  specification without restarting the interview.
- `slice-work` proposes tracer-bullet vertical slices, each sized for one fresh
  context and carrying explicit blocking edges.

The skill should preview the dependency graph and require user approval before
publishing tickets. Publication should use a compatible ticket capability when
available rather than reading another Darrow plugin's files. Each resulting
ticket can then be delivered independently by `darrow-ticket-pipeline`.

Wide mechanical migrations need an explicit expand-migrate-contract branch
instead of being forced into vertical slices.

Relevant upstream skills:

- [`to-spec`](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md)
- [`to-tickets`](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md)

### 4. Periodic codebase-design review

A read-only architecture-maintenance skill could inspect frequently changed or
explicitly named areas for:

- interfaces that expose nearly as much complexity as their implementation;
- behavior scattered across callers instead of concentrated behind a seam;
- missing, shallow, or misplaced public test seams; and
- navigation friction that repeatedly affects changes.

It should report a small number of evidence-backed candidates and let the user
select one for discovery or a bounded goal. Darrow can adopt the hotspot-first,
seam-oriented practice without making one design vocabulary mandatory.

Relevant upstream skills:

- [`codebase-design`](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md)
- [`improve-codebase-architecture`](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md)

### 5. Smaller standalone opportunities

- `handoff-session`: produce a redacted, pointer-rich handoff for a fresh
  session or another harness without copying artifacts already held in specs,
  decisions, tickets, commits, or diffs.
- `resolve-conflicts` in `darrow-git`: resolve merge or rebase conflicts by
  tracing each side to its primary intent, preserving both when compatible,
  and verifying the combined tree before continuing.
- A human-operation wizard may be valuable for credential setup, infrastructure
  dashboards, or one-off cutovers, but only after recurring demand is observed.

Relevant upstream skills:

- [`handoff`](https://github.com/mattpocock/skills/blob/main/skills/productivity/handoff/SKILL.md)
- [`resolving-merge-conflicts`](https://github.com/mattpocock/skills/blob/main/skills/engineering/resolving-merge-conflicts/SKILL.md)
- [`wizard`](https://github.com/mattpocock/skills/blob/main/skills/engineering/wizard/SKILL.md)

## Practices worth adapting

### Invocation is a deliberate boundary

Keep orchestration and consequential multi-step sessions explicitly
user-invoked. Keep reusable disciplines model-invoked only when the model or
another skill genuinely needs to discover them automatically. Darrow already
does this for the goal-loop and ticket-pipeline controllers; new capabilities
should apply the distinction deliberately.

### Add a router when human discovery becomes expensive

As the marketplace grows, consider an explicitly invoked `choose-workflow`
router or a generated workflow map. It should inspect installed capabilities
and route only to what is actually available, preserving plugin independence.

### Separate context load from cognitive load

Skill descriptions and root guidance consume agent context on every turn;
user-invoked skills instead require the human to remember them. Spend each
budget deliberately, keep pointers trigger-rich and compact, and disclose
branch-specific reference material only when its branch is taken.

### Require checkable completion criteria

Each skill phase should finish on a condition that is both observable and
exhaustive. Prefer a concrete artifact, validated result, empty frontier, or
verified state over a subjective statement that enough understanding was
reached.

### Incubate before promotion

Consider an experimental maturity tier for public but unstable plugins or
skills. Graduate them into the promoted marketplace surface only after their
invariants, evals, documentation, and invocation boundaries have stabilized.

Relevant upstream references:

- [`writing-for-agents`](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md)
- [`SKILL-MECHANICS.md`](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL-MECHANICS.md)
- [`ask-matt`](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/SKILL.md)
- [`in-progress` lifecycle](https://github.com/mattpocock/skills/tree/main/skills/in-progress)

## Opportunities not recommended now

- Do not adapt `implement`: it would recouple the goal loop, ticket pipeline,
  TDD, review, and Git publication capabilities that Darrow keeps independent.
- Do not adapt the complete `wayfinder` system: its frontier and fog-of-war
  concepts are useful, but its tracker-backed state machine would introduce a
  third orchestration control plane.
- Defer `triage` until inbound issue volume creates a demonstrated need; ticket
  refinement and challenge already cover delivery readiness.
- Do not duplicate TDD or code review; Darrow already has explicit capabilities
  and stronger deterministic evidence contracts for both.
- Treat teaching, explanation repair, setup wizards, and other productivity
  helpers as demand-driven additions rather than core workflow infrastructure.

## Suggested evaluation order

1. Prototype and evaluate `interview-design` as the only skill in
   `darrow-discovery`.
2. Prototype and evaluate `diagnose-bug` independently.
3. Add research, prototype, questionnaire, or domain-modeling branches only
   when interview evals demonstrate the need.
4. Design `synthesize-spec` and `slice-work` once discovery has a stable output
   contract.
5. Revisit architecture review, handoff, conflict resolution, and a workflow
   router based on observed usage.
