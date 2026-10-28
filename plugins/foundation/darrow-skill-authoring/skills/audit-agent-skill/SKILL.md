---
name: audit-agent-skill
description: Audit or review an existing agent skill or draft SKILL.md for Claude Code and Codex. Always use this to check whether agents will select that skill, whether its actions are safe and authorized, or whether its workflow, prose, evals, and packaging are sound. Return findings without edits. Exclude creation, revision, generic repository guidance, and running an existing suite alone.
---

# Audit an agent skill

Assess one existing skill or named draft without changing it. Give the user
evidence and actionable findings that an implementing agent can use as a
specification.

## 1. Establish scope

Identify the target, claimed hosts, and claims the user wants checked. Read
applicable repository instructions, the target skill or draft, owning plugin
manifests, local references, tests, evals, and relevant commands. Treat an
unreadable required input as a blocker for the dependent claim, and report
missing evidence as unverified.

Read the repository's agent instruction entrypoints and any scoped instruction
for the target before judging consequential actions. Preserve explicit
authority rules in the finding and repair criterion: if the repository
requires user approval, say so. A generic suggestion to ask or stop does not
replace that approval requirement.

**Complete when:** the target, claims, required resources, and evidence gaps
are known without changing checked-in files.

## 2. Check discovery, workflow, and packaging

Judge whether the description names a recognizable goal and trigger, including
the likely neighboring requests that should not select it. Report this
judgment separately even when frontmatter syntax is valid or another package
defect blocks installation.

Trace the skill's inputs, ordered actions, question/refusal boundaries, output,
and checkable completion criteria. For every consequential action, identify
which request or delegation authorizes it, what conditions make it ready, and
when the workflow asks or stops. Name the action when reporting a missing
boundary. Publication or deployment with clear authority and readiness
conditions is a sound boundary, not a defect.

Check plugin self-containment: every required local file is packaged in the
owning plugin, with no dependency on a sibling plugin or a user's machine.
Run safe, read-only validators and existing tests when their prerequisites
are available. The shared inspector belongs to this authoring
plugin, not the target: `<plugin-root>` is two directories above the directory
holding this `SKILL.md`, and the inspector is `<plugin-root>/backend`:

```text
uv run --quiet --no-project "<plugin-root>/backend/scripts/run_locked.py" inspect-skill inspect "<target-skill>" "<target-plugin>"
```

The inspector checks portable metadata and inline Markdown-linked local
resources. Inspect command literals, reference-style links, and other path
forms separately; native validators remain authoritative for their complete
formats. Run scoped eval dry validation only when it leaves checked-in files
unchanged.

**Complete when:** each requested claim and relevant action boundary has
pass, fail, or unverified evidence, including a separate discovery judgment.

## 3. Check the writing

Read [`../../references/writing.md`](../../references/writing.md) and apply
each lever to the target's description, body, and linked references. Report
duplicated meanings, prohibitions that have a positive form, sentences that
restate a default or an environment fact, branch-only detail inlined in
`SKILL.md`, and completion criteria that are vague or undemanding. Quote the
affected text. Mark a no-op claim as a candidate for an eval-guarded pruning
pass; only a matched rerun establishes that removing it is safe.

**Complete when:** every lever has been applied to the whole target, and each
writing finding quotes its text and names its positive repair.

## 4. Report findings

Lead with the audit result and smallest next action. For each defect, name the
affected path and behavior, observed evidence, practical impact, and concrete
acceptance criterion for a repair. Separate skill defects, writing findings,
and missing or invalid eval assertions. Report exact checks run, checks
unavailable, and residual uncertainty. If no defect is found, say what was actually verified
and what remains unverified. Name the target skill's external action, such as
publication, and state that it did not occur during the audit, along with no
checked-in change.

**Complete when:** an implementing agent can act on each finding without
inventing the missing goal or acceptance criterion, and the checked-in
repository remains unchanged.

## Boundaries

- This is a read-only audit. A request to fix findings is ordinary
  implementation work under the target repository's instructions.
- An audit leaves every target and checked-in file as found: it creates no
  skill, promotes no draft, adds no tests, applies no fixes, and never
  installs, publishes, releases, deploys, commits, pushes, or runs the target
  skill's external actions.
