---
name: audit-agent-skill
description: Review, audit, validate, or assess an existing agent skill or draft SKILL.md for Claude Code and Codex. You MUST use this for requests to check whether agents will select that skill, whether its actions are safe and authorized, or whether its workflow, evals, and packaging are sound. Return findings without edits. Exclude creation, revision, generic repository guidance, and running an existing suite alone.
---

# Audit an agent skill

Assess one existing skill or named draft without changing it, and return
findings an implementing agent can use as a specification. Do not execute the
target skill's external actions.

## 1. Establish scope

Identify the target, its claimed hosts, and the claims to check. Read the
repository's agent instructions, any scoped instruction for the target, the
target skill or draft, its plugin manifests, references, tests, evals, and
relevant commands. An unreadable required input blocks the dependent claim;
never infer its contents or count missing evidence as a pass.

Carry explicit repository authority rules into findings and repair criteria:
if the repository requires user approval, say so rather than a generic "ask
first".

**Complete when:** the target, claims, required resources, and evidence gaps
are known without changing checked-in files.

## 2. Check discovery, workflow, and packaging

Judge whether the description names a recognizable goal and trigger and
excludes likely neighboring requests. Report this judgment separately, even
when the frontmatter is valid or another defect blocks installation.

Trace inputs, ordered actions, ask/refuse boundaries, output, and completion
criteria. For each consequential action, name what authorizes it, when it is
ready, and when the workflow asks or stops. List the authority and readiness
conditions the target already states before naming gaps. Publication or
deployment is not a defect when its authority and conditions are clear.

Check self-containment: required files are packaged in the owning plugin, and
nothing depends on a sibling plugin or the user's machine. Run safe, read-only
validators and existing tests when available. The shared inspector lives at
`<plugin-root>/backend`, two directories above this skill:

```text
uv run --quiet --no-project "<plugin-root>/backend/scripts/run_locked.py" inspect-skill inspect "<target-skill>" "<target-plugin>"
```

It checks portable metadata and inline Markdown links; inspect command
literals and other paths yourself. Run eval dry validation only when it leaves
checked-in files unchanged. Do not promote a draft, add tests, apply fixes,
commit, or perform the target's publication or deployment actions.

**Complete when:** each requested claim and action boundary has pass, fail,
or unverified evidence, including a separate discovery judgment.

## 3. Report findings

Lead with the audit result and smallest next action. For each defect, give the
affected path and behavior, observed evidence, practical impact, and a
concrete acceptance criterion for the repair. Separate skill defects from eval
defects. List the checks run, checks unavailable, and remaining uncertainty.
If nothing is wrong, say what was verified and what was not. State that no
target action or checked-in change was performed.

**Complete when:** an implementing agent can act on each finding without
inventing the goal or acceptance criterion, and the repository is unchanged.

## Boundaries

- This is a read-only audit. Fixing findings is ordinary implementation work.
- Do not create or edit a skill, install, publish, release, deploy, commit, or
  push as part of an audit.
