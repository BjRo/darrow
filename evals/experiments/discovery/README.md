# Discovery skill evaluation

This suite compares the installed `darrow-discovery` skill surface with an
uncontaminated no-skill baseline. Both modes use the same prompts, fixtures,
hidden checks, harness, model, effort, threshold, and trial count. The only
difference is whether the case's skill or plugin skills are mounted.

The primary suite covers direct discovery behavior, incomplete input, adjacent
planning intent, pressure to invent product choices, direct implementation
planning with an unresolved frontier, and competition between feature
discovery and implementation planning. The separate
`implementation-negative-suite.yaml` keeps the settled implementation request
visible without forcing its materially higher execution cost into every
repeated activation run.

`activation-suite.yaml` isolates selection evidence for four representative
fresh-context routes: a direct grilling trigger, adjacent planning intent that
must not select grilling, feature discovery competing with its sibling skills,
and implementation planning competing with the same sibling set. Activation
is reported independently from each case's existing outcome checks. Claude's
structured harness stream exposes the direct `Skill` tool event; Codex reports
the first completed mounted `SKILL.md` body read as an explicitly labeled
controlled probe. Both adapters retain bounded selection and terminal
accounting records rather than ordinary assistant messages or command output.

After a broad N=1 comparison identifies decision-bearing deltas,
`value-suite.yaml` repeats only direct frontier behavior, subjectless input,
and pressure against inventing a final brief. This avoids multiplying cases
where both modes already passed while still testing whether observed value is
stable rather than a convenient single run.

Dry validation:

```sh
cd evals
bun runner/suite.ts --suite experiments/discovery/suite.yaml --dry --no-judge
bun runner/suite.ts \
  --suite experiments/discovery/activation-suite.yaml \
  --dry \
  --no-judge
bun runner/suite.ts \
  --suite experiments/discovery/implementation-negative-suite.yaml \
  --dry \
  --no-judge
```

Matched live comparison with pinned models:

```sh
cd evals
bun runner/suite.ts \
  --suite experiments/discovery/suite.yaml \
  --trials 3 \
  --threshold 0.8 \
  --effort medium \
  --claude-model claude-sonnet-5 \
  --codex-model gpt-5.6-terra \
  --no-judge
```

Matched cross-harness activation evidence:

```sh
cd evals
bun runner/suite.ts \
  --suite experiments/discovery/activation-suite.yaml \
  --trials 3 \
  --threshold 0.8 \
  --effort medium \
  --claude-model claude-sonnet-5 \
  --codex-model gpt-5.6-terra \
  --no-judge
```

Run the expensive settled-implementation probe as an explicitly limited N=1
comparison and report that limitation instead of treating it as stable:

```sh
cd evals
bun runner/suite.ts \
  --suite experiments/discovery/implementation-negative-suite.yaml \
  --trials 1 \
  --threshold 0.8 \
  --effort medium \
  --claude-model claude-sonnet-5 \
  --codex-model gpt-5.6-terra \
  --no-judge
```

Raw results are written under the gitignored experiment-specific tree in
`evals/results/`. Review `report.md` and, for a declared ablation,
`ablation.md` together: the general report shows outcomes and activation as
separate evidence, while the ablation report rejects unmatched cells and
preserves every baseline-to-candidate task delta.

Activation cases reference both discovery behavior and shared evaluation
invariants. A discovery-scoped coverage check must therefore load both specs:

```sh
bun evals/runner/coverage.ts \
  --spec docs/specs/discovery.md \
  --spec docs/specs/skill-evaluation.md \
  --eval-root plugins/capability/darrow-discovery
```
