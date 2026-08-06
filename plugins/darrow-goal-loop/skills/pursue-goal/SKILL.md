---
name: pursue-goal
description: Pursue one bounded engineering goal through an adaptive, local-only executor and verification loop. Use only when explicitly invoked; this capability may call multiple models and edit the working tree.
disable-model-invocation: true
---

# Pursue a goal

Return a verified local working tree with the least orchestration the goal
requires.

## Working model

- **Thin controller:** inspect, route, invoke, snapshot, and aggregate. Delegate
  every product-file edit to an executor or repair executor.
- **One writer:** at most one write-capable child is active. Planner and
  verifier roles are fresh and read-only with respect to product files.
- **Local boundary:** verification authorizes no branch, worktree, commit, push,
  PR, merge, release, deployment, or external mutation.
- **Bounded recovery:** permit at most one repair followed by a fresh verifier.
- **Transient state:** keep packets, snapshots, evidence, and results outside
  the target repository.

Use the shortest safe role sequence:

| Goal shape | Roles | Profile |
| --- | --- | --- |
| Natural-language documentation, pure formatting, or generated output with a complete byte-level oracle | executor | `fast` |
| Clear source, data, fixture, test, configuration, schema, dependency, or behavior change | executor → verifier | `standard` |
| Architectural, cross-boundary, materially ambiguous, or non-obvious test strategy | planner → executor → verifier | `deep` planner; `standard` implementation; `deep` verification when risky |
| One actionable failed verification | repair → fresh verifier | match the work's risk |

## Workflow

### 1. Bind the goal and repository

Resolve the target repository and the bundled CLI to absolute paths:

```sh
skill_dir=<absolute directory containing this SKILL.md>
goal_loop="$skill_dir/../../bin/goal-loop"
bash "$goal_loop" preflight --repo "$repo" --telemetry best_effort
```

Use `--telemetry strict` only when the user selected strict telemetry. Strict
preflight must establish authenticated export readiness before any paid child;
otherwise stop as `blocked`. Best-effort export degradation remains separate
from the code verdict.

Keep the returned run ID and preflight path. Treat every recorded pre-existing
change and fingerprint as user-owned. If requested work overlaps a pre-existing
path, stop for user direction. Preserve all recorded bytes, staging state, and
paths through the final snapshot.

Translate the request into observable acceptance criteria without changing its
product intent. Record scope, non-goals, absolute applicable instruction and
accepted-decision paths, and deterministic gates discovered from instructions,
manifests, CI, and component practice. Refuse unreadable applicable
configuration. When no lint, type, or test gate exists, record one
`not_applicable` gate with the discovery evidence; absence is not a pass.

**Complete when:** the stable run, base revision, preserved local work,
objective, criteria, scope, authority, and every applicable or explicitly
inapplicable gate are bound before a child is invoked.

### 2. Select roles, authority, and routes

Skip planning when objective, scope, behavior, and verification are clear. Use
one fresh planner when the task crosses architectural boundaries, changes a
public contract or schema, contains material product ambiguity, or needs a
non-obvious test strategy. Never spend a model call on routing.

Before any writer, stop as `needs_human` with the smallest missing decision
when work requires an irreversible operation, destructive migration, security
or privacy policy, external publication, materially ambiguous product behavior,
or authority absent from the request. Destructive data, authentication or
authorization, secrets, privacy, billing, broad migrations, and weakly
verifiable external effects require an approved plan. An already approved
specification or plan satisfies that gate.

Resolve each chosen role mechanically:

```sh
bash "$goal_loop" route --host <codex|claude> --role <planner|executor|verifier|repair> \
  --profile <fast|standard|deep> --native <yes|no|unknown>
```

Normal implementation and verification use `standard`; risky or ambiguous
planning and verification use `deep`. Reserve `fast` for the mechanical oracle
path in the table—a small code change is still `standard`. Pass an explicit
user route as `--route 'harness|provider|model|effort'`; if unavailable, stop
without substitution. A policy-selected route may use only the CLI's declared
fallback, and the result must expose it.

**Complete when:** the minimal role sequence, profile, actual route or declared
fallback, and all required pre-write authority are explicit—or the run has an
evidence-backed `needs_human` or `blocked` outcome before a writer starts.

### 3. Invoke isolated roles

Read [`references/child-protocol.md`](references/child-protocol.md) completely
before creating the first packet.

Invoke the selected roles in order:

1. If selected, run one read-only planner. Normalize and validate its result,
   but first take a unique snapshot and retain its fingerprint. After the
   planner, take another snapshot with `--expect-fingerprint` set to that
   pre-planner value. Reapply the human gate to its decisions before starting a
   writer.
2. Run one executor as the sole active writer. The controller must not
   implement, repair, or start parallel implementation agents. Wait for it to
   finish, then normalize and validate its result.
3. Run any explicit controller-only diagnostic or fixture instruction at its
   user-named boundary; keep it out of every child packet. Then capture a
   unique post-execution snapshot and absolute final-diff path.
4. For substantive work, run one fresh verifier against that final diff and
   audit its read-only boundary with a post-verifier snapshot whose
   `--expect-fingerprint` is the post-execution fingerprint. This post-verifier
   artifact is the final snapshot. Omit the verifier only for the exact
   mechanical-oracle path in the table, when the changed artifact cannot encode
   product behavior and no repository or task instruction conflicts over scope,
   authority, or verification. A `.txt` extension or exact assertion alone does
   not make a data/value file prose-only. Record the exception and oracle
   evidence. Uncertainty requires verification.

Create snapshots at distinct absolute paths outside the repository:

```sh
bash "$goal_loop" snapshot --preflight "$preflight" \
  [--expect-fingerprint "$prior_fingerprint"] --output "$unique_snapshot"
```

Use the CLI when the controller obtains or confirms a deterministic result:

```sh
bash "$goal_loop" gate --repo "$repo" --name "$gate_name" \
  --command "$gate_command" --time-seconds "$gate_timeout" \
  --evidence "$absolute_evidence"
```

Copy its `result_evidence` value into the gate record and classify the outcome
with **Gate outcomes** in `child-protocol.md`. Distinguish a proven pre-existing
failure from a regression, and accept changed tests as evidence only after they
pass on the final tree.

If the verifier returns actionable findings, read
[`references/repair-protocol.md`](references/repair-protocol.md) completely and
follow it once. Do not improvise another recovery cycle.

**Complete when:** every invoked role has a normalized, validated result; every
reader's no-write boundary is snapshot-proven; the final tree and gates have
current evidence; and verification is passed, explicitly not required, or
honestly failed/blocked after the single allowed repair.

### 4. Finalize and report

Read [`references/result-protocol.md`](references/result-protocol.md)
completely. Emit the required privacy-safe telemetry, assemble the transient
result, and validate it against every packet/result pair in invocation order
and the final post-reader snapshot.

Lead the response with the evidence-derived outcome. Summarize changed files,
gates, independent findings and repair, routes, telemetry, remaining risk, and
the smallest next action. Provide the absolute validated result path and the
validated record verbatim in one `tsv` fence. State that `verified` is local
only and implies no publication.

**Complete when:** the validated result reconciles the final working tree,
roles, gates, verification, budgets, permissions, and telemetry, and the user
can distinguish a verified local result from any unpublished or blocked work.
