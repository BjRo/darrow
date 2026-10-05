---
name: audit-agent-skill
description: Review, audit, validate, or assess an existing agent skill or draft SKILL.md for Claude Code and Codex. You MUST use this for requests to check whether agents will select that skill, whether its actions are safe and authorized, or whether its workflow, evals, and packaging are sound. Return findings without edits. Exclude creation, revision, generic repository guidance, and running an existing suite alone.
---

# Audit an agent skill

Assess one existing skill or named draft without changing it. Give the user
evidence and actionable findings that an implementing agent can use as a
specification. Do not execute the target skill's external actions.

## 1. Establish scope

Identify the target, claimed hosts, and claims the user wants checked. Read
applicable repository instructions, the target skill or draft, owning plugin
manifests, local references, tests, evals, and relevant commands. Treat an
unreadable required input as a blocker for the dependent claim. Do not infer
contents or mark missing evidence as a pass.

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
boundary. Do not treat publication or deployment as inherently defective when
authority and readiness conditions are clear.

Check plugin self-containment: required local files must be packaged in the
owning plugin, and references must not depend on a sibling plugin or a user's
machine. Run safe, read-only validators and existing tests when their
prerequisites are available. The shared inspector is at `<plugin-root>/backend`,
where `<plugin-root>` is two directories above this skill directory:

```text
uv run --quiet --no-project "<plugin-root>/backend/scripts/run_locked.py" inspect-skill inspect "<target-skill>" "<target-plugin>"
```

The inspector checks portable metadata and inline Markdown-linked local
resources. Inspect command literals, reference-style links, and other path
forms separately; native validators remain authoritative for their complete
formats. Run scoped eval dry validation only when it does not alter checked-in
files. Do not promote a draft to `SKILL.md`, add tests, apply fixes, commit, or
perform the target skill's publication or deployment actions.

**Complete when:** each requested claim and relevant action boundary has
pass, fail, or unverified evidence, including a separate discovery judgment.

## 3. Report findings

Lead with the audit result and smallest next action. For each defect, name the
affected path and behavior, observed evidence, practical impact, and concrete
acceptance criterion for a repair. Separate skill defects from missing or
invalid eval assertions. Report exact checks run, checks unavailable, and
residual uncertainty. If no defect is found, say what was actually verified
and what remains unverified. State that no target action or checked-in change
was performed.

**Complete when:** an implementing agent can act on each finding without
inventing the missing goal or acceptance criterion, and the checked-in
repository remains unchanged.

## Boundaries

- This is a read-only audit. A request to fix findings is ordinary
  implementation work under the target repository's instructions.
- Do not create a new skill, edit a target, install, publish, release, deploy,
  commit, or push as part of an audit.
