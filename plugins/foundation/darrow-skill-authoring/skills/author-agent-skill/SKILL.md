---
name: author-agent-skill
description: Create, revise, or validate one agent skill as a focused, self-contained capability for Claude Code and Codex. Use when asked to author or edit SKILL.md, define skill trigger metadata, add colocated resources or deterministic checks, repair an over-broad or unreliable skill, or evaluate skill discovery and workflow behavior. Do not use for general AGENTS.md or CLAUDE.md prose, plugin-only packaging without a skill, or merely running an existing suite.
---

# Author an agent skill

Create one discoverable, bounded, evaluated skill for one recognizable user goal. Discovery metadata, workflow behavior, resources, and verification are one public interface.

Run the bundled inspector with Bash. `<skill-dir>` is this file's directory, `<target-skill>` is the target skill directory, and `<plugin-root>` owns it:

```sh
bash <skill-dir>/scripts/inspect-skill inspect <target-skill> <plugin-root>
```

The inspector validates portable metadata and containment for inline Markdown-linked local resources. Inspect command literals, reference-style links, and other path forms separately; native runtime validators remain authoritative.

## Workflow

Read applicable repository instructions before selecting either branch.

Choose **validation-only** for an audit with no requested fixes. Keep the repository read-only: establish claims and runtimes; read the skill, manifests, tests, evals, and required resources; run the inspector, native validators, script tests, and scoped dry validation; inspect path forms the inspector misses; then report evidence, limitations, and risks.

**Done when:** Every requested claim has pass, fail, or unverified evidence and the checked-in repository is unchanged.

Choose **creation/revision** for a new skill or requested fixes. Follow every phase below; "validate and fix" is revision.

### 1. Establish the contract

Read target manifests. Define the one user goal, inputs, user-visible output, supported runtimes and destination, facts not to infer, ask/stop/refuse conditions, and observable completion criteria.

Record these inputs explicitly:

- The request that should select the skill.
- The requested files and supported hosts.
- The output the user can observe.
- The authority and safety boundaries that remain with the user.

Keep each claim tied to an observable check. A missing runtime, destination, or
side-effect decision is a question, not an invitation to choose on the user's
behalf.

Before changing prose, write direct, indirect, incomplete-input, negative-trigger, and plausible counterexample requests. For a revision, run them against the current skill or an uncontaminated no-skill condition when supported. Record observed failures; when a baseline is unavailable, state that limitation rather than inventing a red result.

The incomplete request must expose the missing input. The negative request must
not select the skill. The pressure case must test a boundary a superficial
revision could miss.

If the goal, destination, side effects, or runtime support is materially undefined, ask one compact group covering every material unknown and leave the repository unchanged. When both goal and destination are missing, ask for both.

**Done when:** The boundary is unambiguous, the request matrix exists, and every success claim has a check or stated evaluation limitation.

### 2. Inspect the existing surface

For a revision, run the inspector before editing and read the existing `SKILL.md` completely. Follow its absolute paths to task-relevant resources; inspect manifests, evals, script tests, and repository commands. An unreadable required input blocks dependent recommendations.

Read linked resources only when their stated condition applies. If a resource
needed for a proposed claim is unreadable, stop that claim rather than treating
the missing evidence as an empty success.

For a new skill, inspect destination conventions and use the standard local skill location or a repository scaffold when present. Read [`references/practice-basis.md`](references/practice-basis.md) only when choosing among invocation, disclosure, or evaluation approaches, or when maintaining this workflow.

**Done when:** The target, loaders, manifests, tests, references, and unreadable blockers are known from repository evidence.

### 3. Design discovery and hierarchy

#### Metadata

Use a lower-case hyphenated, verb-led name matching the directory. Front-load a concise description with recognizable triggers and a meaningful exclusion; keep procedure in the body.

The description should tell a user when to invoke the capability before it
explains how the capability works. Do not make it a checklist or duplicate the
workflow.

#### Workflow

Keep one bounded workflow. State inputs, ordered actions, output, facts not to infer, ask/stop/refuse conditions, and a demanding checkable completion criterion for every phase. Split work whose triggers, inputs, or success criteria differ.

Do not merge a read-only audit with a mutating revision. Keep the validation
branch read-only even when its findings suggest a likely repair.

#### Resources

Keep universal judgment in `SKILL.md`; put branch-specific or heavy detail one linked level away, deterministic repeatable mechanics in `scripts/`, and output templates in `assets/`. State when to load or run each resource. Remove duplicated, derivable, historical, no-op, and unused material.

Use a script only for a narrow, repeatable mechanic. A script must fail closed
on unreadable input and keep its output stable enough for tests or automation.

Use portable `name` and `description` frontmatter. Put optional Codex UI metadata in `agents/openai.yaml`; add host-specific frontmatter only when required and verify the other host. The inspector accepts Claude's optional boolean `disable-model-invocation` but fails closed on other unknown frontmatter; keep the Codex policy in `agents/openai.yaml`.

Keep the skill independently installable and self-contained: every required file stays in the target plugin; local links and command paths resolve skill-relatively; and nothing depends on a sibling plugin, MCP server, unavailable service, or user-global file.

**Done when:** Every instruction has one owner, every resource has a load condition, and metadata distinguishes the goal without summarizing the procedure.

### 4. Add acceptance evidence

Add evidence at the stable public seam before implementation: script tests for deterministic contracts, behavior evals for judgment and safety, and activation cases for direct, indirect, incomplete, negative, and edge input. Keep eval prompts participant-visible and pass criteria in hidden checks or rubrics. Include a plausible counterexample and prefer repository state or user-visible output over private reasoning.

Use both shells for every bundled shell test. When a behavior change has a
durable regression seam, show the focused evidence fail before the relevant
production change and pass afterward.

Run the smallest baseline or dry validation and confirm new evidence fails for the intended reason, not fixture or syntax errors.

**Done when:** Acceptance evidence detects the missing behavior at a durable seam without revealing its answer.

### 5. Implement the smallest slice

Write imperative instructions with explicit inputs and outputs. Add only resources the evidence requires. Scripts take narrow arguments, give stable output, refuse unreadable inputs, and use absolute paths in model-facing output; keep contextual choices and trade-offs in `SKILL.md`.

Keep deterministic parsing, validation, and reporting mechanics in scripts;
keep interpretation, policy choices, and trade-offs in the skill body.

Avoid daemons, queues, hidden side effects, and installation changes; preserve authority for consequential actions.

**Done when:** Focused evidence passes with the minimal coherent skill, resources, and packaging changes.

### 6. Verify and challenge

Run, in order: bundled script tests with Bash 5 and `/bin/bash` 3.2; the inspector; skill and manifest validators; scoped dry validation and live trials on repository-selected harnesses; affected documentation/discovery checks; and applicable lint, type, or test gates.

Report trial count, commands, outcomes, evaluation limitations, and residual
risks. Do not claim a live result from a dry run.

If a required live harness cannot run, report the exact limitation and retain
the dry evidence as dry evidence only.

Give a fresh-context reviewer the finished artifact and task-local evidence, but neither the intended answer nor prior conclusions. Address material findings, rerun affected checks, then review the final diff for external references, prohibited runtime machinery, accidental side effects, unrelated edits, and unsupported claims.

The reviewer challenges discovery, self-containment, portability, safety,
completion bounds, and eval loopholes. Its review does not expand authority.

**Done when:** Focused and repository gates pass after independent review, material findings are resolved or reported, and the final response gives exact evidence without overstating authority.

## Boundaries

- Keep one capability outcome per skill.
- Use this only to create, revise, or validate reusable agent skills—not ordinary instruction-file prose, plugin-only packaging, or a routine suite run.
- Do not invent an unapproved capability, infer a materially missing goal or destination, or require a fixed model-trial count regardless of risk.
- Do not commit, push, open a pull request, install, publish, release, or deploy unless separately authorized.
