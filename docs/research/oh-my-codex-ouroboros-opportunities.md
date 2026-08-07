# Workflow Opportunities from oh-my-codex and Ouroboros

Status: exploratory research, not an accepted decision or implementation plan  
Reviewed: 2026-08-07  
Sources:
[Yeachan-Heo/oh-my-codex at a62d5bd](https://github.com/Yeachan-Heo/oh-my-codex/tree/a62d5bd77bef6d2bc7df467dcae68082b8616239/skills),
[Q00/ouroboros at 9486c78](https://github.com/Q00/ouroboros/tree/9486c78575a0332e9b84d93ef5832985291d7943/skills)

## Purpose

This note preserves practices and capability ideas from oh-my-codex (OMX) and
Ouroboros that could meaningfully extend Darrow. It contrasts their operating
models with Darrow so useful methods can be adapted without importing a third
orchestration control plane.

It does not authorize a new plugin, select final names, or change the explicit
boundaries of `darrow-goal-loop` and `darrow-ticket-pipeline`. It complements
the separate
[research into Matt Pocock's skills](matt-pocock-workflow-opportunities.md).

## Comparative model

| Concern       | Darrow                                                                 | oh-my-codex                                                                | Ouroboros                                                          |
| ------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Product shape | Marketplace of independently adoptable capabilities                    | Integrated Codex operating layer                                           | Specification-first evolutionary workflow engine                   |
| Orchestration | Bounded transient goal loop and static ticket pipeline                 | Autopilot, Ultragoal, Team, Ralph, Pipeline, review, and QA modes          | Interview, Seed, Execute, Evaluate, Evolve, Auto, and Ralph cycles |
| State         | Transient goal state or one durable tracker ticket                     | Plans, memory, mode, team, and goal state under `.omx/`                    | Sessions, immutable Seeds, events, execution state, and lineages   |
| Assurance     | Observable criteria, deterministic mechanics, and fresh verification   | Consensus planning, implementation review, QA, and specialist visual loops | Mechanical, semantic, and optional multi-model evaluation          |
| Main strength | Composable capability boundaries and independently checkable mechanics | Broad operating UX and specialist workflows                                | Deep requirements, specification, and convergence machinery        |
| Darrow risk   | N/A                                                                    | Mode proliferation and runtime coupling                                    | Reintroducing a durable general workflow engine                    |

At the reviewed snapshots, OMX exposes 46 skill files, including 16
hard-deprecated compatibility shims. Ouroboros exposes 22 skill files with
roughly 6,800 lines of operational instructions. Darrow currently exposes 22
skill files with roughly 2,700 lines and places more mechanics in scripts and
evals. The comparison is not a quality score; it illustrates the materially
different runtime and resident-instruction costs.

## Recommended opportunities

### 1. Strengthen the proposed discovery capability

Both systems reinforce `darrow-discovery` as the highest-value next capability.
The initial `interview-design` skill should retain the decision-tree method
already proposed in the Matt Pocock research and add several complementary
mechanics:

- classify each unknown as a discoverable fact, a fact needing confirmation,
  or a human decision;
- track independent ambiguity fronts for scope, constraints, outputs,
  verification, non-goals, terminology, and decision boundaries;
- preserve provenance such as `from-code`, `from-research`, `from-user`, and
  `assumption` without turning those labels into a new durable data model;
- ask dependent questions sequentially while batching only independent
  questions on the current frontier;
- keep repository and external research from silently deciding product intent;
- run one bounded independent closure check for hidden assumptions, missing
  requirements, and unverifiable acceptance criteria; and
- finish with a one-sentence goal restatement that the user confirms before the
  discovery brief is considered ready.

The closure condition should be a checkable readiness checklist and an empty
material decision frontier. Darrow should not adopt an apparently precise
ambiguity score such as `0.20` unless it first has a calibrated evaluator and
evidence that the score predicts downstream success.

The default output remains a concise, non-authoritative discovery brief. It
does not implement, create tickets, record accepted decisions, or start another
orchestrator.

Relevant upstream skills:

- OMX
  [`deep-interview`](https://github.com/Yeachan-Heo/oh-my-codex/blob/a62d5bd77bef6d2bc7df467dcae68082b8616239/skills/deep-interview/SKILL.md)
- Ouroboros
  [`interview`](https://github.com/Q00/ouroboros/blob/9486c78575a0332e9b84d93ef5832985291d7943/skills/interview/SKILL.md)
- Ouroboros
  [`seed`](https://github.com/Q00/ouroboros/blob/9486c78575a0332e9b84d93ef5832985291d7943/skills/seed/SKILL.md)

### 2. Add problem reframing after interviewing stabilizes

A later `reframe-problem` skill in `darrow-discovery` could help when work has
stagnated because the current framing or approach may be wrong.

It should:

1. Require the problem, current approach, and known failed attempts.
2. Generate a small set of materially different lenses, such as missing
   evidence, simplification, structural redesign, constraint challenge, and
   contrarian reframing.
3. State the largest assumption challenged by each proposal.
4. Label every proposal as a hypothesis rather than a verdict.
5. Let the user choose, combine, or reject the proposals.
6. Stop without implementing or automatically restarting a goal or pipeline.

The skill should not require a fixed five-persona fan-out. One or more isolated
perspectives are useful only when they add genuinely different hypotheses.

Relevant upstream skill:

- Ouroboros
  [`unstuck`](https://github.com/Q00/ouroboros/blob/9486c78575a0332e9b84d93ef5832985291d7943/skills/unstuck/SKILL.md)

### 3. Separate ordinary research from validator-gated research missions

OMX distinguishes ordinary pre-planning evidence gathering from research whose
output is itself a measured deliverable. Darrow can preserve that distinction
without creating another runtime:

- `research-question` should be a terminal, read-only discovery skill that
  prefers official and upstream sources, records version and date context,
  distinguishes external evidence from repository facts, and stops with a
  cited recommendation or exact evidence gap;
- a research mission that must iterate until a measurable artifact passes
  should use `darrow-goal-loop` with an explicit validator and acceptance
  criteria; and
- research evidence may feed discovery, planning, or ticket creation but does
  not become an accepted architecture decision by itself.

Relevant upstream skills:

- OMX
  [`best-practice-research`](https://github.com/Yeachan-Heo/oh-my-codex/blob/a62d5bd77bef6d2bc7df467dcae68082b8616239/skills/best-practice-research/SKILL.md)
- OMX
  [`autoresearch`](https://github.com/Yeachan-Heo/oh-my-codex/blob/a62d5bd77bef6d2bc7df467dcae68082b8616239/skills/autoresearch/SKILL.md)

### 4. Make acted verification equally explicit in the goal loop

Ouroboros correctly distinguishes inspection from observation: behavior-bearing
work should be run through its real public boundary and judged from the actual
effect rather than source shape, success prose, or an incidental log line.

`darrow-ticket-pipeline` already has this stronger contract in `qa-ticket`:
each criterion records setup, literal action, independent assertion, observed
value, and result. It rejects mocks, source-only inference, incidental side
effects, and reuse of review approval as QA evidence.

The goal-loop verifier should use equally explicit language:

- execute the real command, endpoint, UI, service, or public API when the
  environment and authority permit;
- record the observed value or effect against the independent oracle;
- treat unavailable required observation as blocked rather than passed;
- distinguish executor claims and logs from verification evidence; and
- after repair, rerun the exact failed observation before broader gates.

This is an enhancement to the existing verifier contract, not a new plugin or
evaluation phase.

Relevant upstream skills:

- Ouroboros
  [`evaluate`](https://github.com/Q00/ouroboros/blob/9486c78575a0332e9b84d93ef5832985291d7943/skills/evaluate/SKILL.md)
- Ouroboros
  [`qa`](https://github.com/Q00/ouroboros/blob/9486c78575a0332e9b84d93ef5832985291d7943/skills/qa/SKILL.md)

### 5. Diagnose Darrow installation and cross-harness health

OMX treats static installation checks and a real authenticated execution smoke
test as different evidence. A small Darrow installation doctor could improve
the marketplace experience across Claude Code and Codex.

A provisional `doctor-installation` capability could check:

- Claude and Codex manifest validity and skill-directory routing;
- plugin independence and references that escape the package;
- installed cache, manifest, and marketplace version mismatches;
- required command availability and readable configuration;
- Bash 3.2 and Bash 5 script behavior; and
- a minimal real skill-discovery or invocation smoke test when the host exposes
  a safe way to perform one.

Diagnosis should be read-only by default. Repair, reinstallation, cache
mutation, or authentication changes require explicit user authority.

Relevant upstream skill:

- OMX
  [`doctor`](https://github.com/Yeachan-Heo/oh-my-codex/blob/a62d5bd77bef6d2bc7df467dcae68082b8616239/skills/doctor/SKILL.md)

### 6. Later specialist opportunities

#### General artifact verification

A standalone `evaluate-artifact` skill could assess documents, configurations,
API responses, generated artifacts, screenshots, or other deliverables against
an explicit quality bar. It should use deterministic and acted evidence before
semantic judgment, report concrete differences, and add an independent second
opinion only for high-risk or genuinely uncertain cases.

It should not overlap `darrow-review`, which remains a pinned code-change review,
or claim that an arbitrary numeric score is calibrated assurance.

#### Behavior-preserving simplification

A provisional `simplify-change` skill could adapt OMX's cleanup kernel:

- lock observable behavior with existing or narrowly added regression tests;
- accept a changed-file list as a hard scope boundary;
- inventory and classify fallback-like code before editing;
- address one smell class at a time with focused verification between passes;
  and
- finish with explicit simplifications, retained compatibility behavior,
  gates, and residual risks.

This should not become a mandatory phase in the goal loop or ticket pipeline.

Relevant upstream skill:

- OMX
  [`ai-slop-cleaner`](https://github.com/Yeachan-Heo/oh-my-codex/blob/a62d5bd77bef6d2bc7df467dcae68082b8616239/skills/ai-slop-cleaner/SKILL.md)

#### Design context and visual verification

For UI-heavy users, Darrow could eventually separate:

- a durable repository-native design contract covering product goals, users,
  information architecture, visual language, accessibility, responsive
  behavior, and open decisions; and
- visual implementation verification using an approved reference, reproducible
  screenshot setup, viewport and state capture, visual judgment, and pixel diff
  only as diagnostic evidence.

The design skill should discover and maintain the repository's existing
canonical design source instead of universally imposing `DESIGN.md`. Visual
verification should remain a specialist public-boundary oracle rather than a
new orchestration loop.

Relevant upstream skills:

- OMX
  [`design`](https://github.com/Yeachan-Heo/oh-my-codex/blob/a62d5bd77bef6d2bc7df467dcae68082b8616239/skills/design/SKILL.md)
- OMX
  [`visual-ralph`](https://github.com/Yeachan-Heo/oh-my-codex/blob/a62d5bd77bef6d2bc7df467dcae68082b8616239/skills/visual-ralph/SKILL.md)

## Practices worth adapting across capabilities

### Separate evidence, inference, decision, and unknown

Material conclusions should identify whether they are directly evidenced,
inferred, chosen by the user, assumed, or unresolved. This is especially useful
in discovery, research, analysis, and review. The labels need not become a
repository-wide serialization format.

Relevant upstream skill:

- OMX
  [`analyze`](https://github.com/Yeachan-Heo/oh-my-codex/blob/a62d5bd77bef6d2bc7df467dcae68082b8616239/skills/analyze/SKILL.md)

### Prefer explicit clearance over subjective completion

Questioning, research, planning, implementation, and verification should each
end on observable gates. Checklist clearance, an empty material frontier, a
validated artifact, or literal command evidence is stronger than a model's
statement that it has enough understanding.

### Preserve user reasoning when summarizing

When an agent structures a free-form answer for a later consumer, it should
retain the user's reasoning, constraints, exclusions, and corrections. A
confirmation gate is warranted when compression may materially change intent;
it should not be required for every trivial answer.

### Focus repair on failed criteria

Ouroboros freezes passing acceptance nodes and reopens only failed or regressed
ones while rechecking their boundaries. Darrow already follows the useful part
of this practice: the goal loop repairs named verifier findings, and ticket QA
fixes rerun the exact failed observation. Preserve that focus rather than
adding evolutionary lineage machinery.

### Treat lifecycle cost as part of skill design

OMX's compatibility shims illustrate the discovery and resident-context cost of
a broad skill catalog. Darrow should prefer an experimental maturity tier,
clear migration notes, and actual removal over permanent aliases that remain
discoverable as skills.

## Opportunities not recommended

- Do not adapt OMX `autopilot`, `team`, `pipeline`, `ralph`, `ultragoal`, or
  their durable `.omx` control plane. They overlap Darrow's two deliberately
  bounded orchestrators and rely on runtime state, hooks, tmux, or broad mode
  coordination.
- Do not adapt Ouroboros `auto`, `run`, `ralph`, or `evolve` as a new Darrow
  runtime. Its sessions, EventStore, immutable Seed lineage, background jobs,
  and generation state are the general workflow machinery Darrow excludes.
- Do not impose one universal Seed YAML, ontology schema, `DESIGN.md`, context
  directory, or repository memory store.
- Do not use model-majority voting as a substitute for independent oracles,
  public-boundary observations, and traceable findings.
- Do not adopt fixed ambiguity, quality, drift, or ontology-similarity scores
  without calibrated evaluators and evidence that their thresholds predict the
  intended outcome.
- Do not fan out permanent personas by default. Add isolated perspectives only
  when the question benefits from materially different evidence or hypotheses.
- Do not interrupt an active workflow with automatic update checks.
- Do not create a workflow router until capability discovery is a demonstrated
  user problem; a generated capability map remains the cheaper first response.

## Suggested evaluation order

1. Prototype and evaluate `darrow-discovery/interview-design` as the only new
   discovery skill, including provenance, breadth tracking, closure review, and
   the final restatement gate.
2. Align the goal-loop verifier with ticket QA's act-and-observe evidence
   contract.
3. Prototype `research-question` as a terminal discovery skill.
4. Add `reframe-problem` only after the discovery output contract is stable.
5. Prototype a read-only `doctor-installation` capability.
6. Revisit general artifact verification, simplification, and visual workflows
   based on observed demand.

The resulting opportunity map is:

```text
idea
  -> interview-design
       -> research-question, when evidence is missing
       -> reframe-problem, when the approach is stuck
  -> discovery brief
       -> bounded goal
       -> work plan -> tickets -> ticket pipeline
```

The external systems contribute sharper reasoning and assurance methods.
Darrow's complementary role is to package those methods as small, independent
capabilities rather than becoming another operating environment.
