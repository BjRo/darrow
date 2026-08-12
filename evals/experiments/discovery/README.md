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
  --codex-model gpt-5.5 \
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
  --codex-model gpt-5.5 \
  --no-judge
```

Raw results are written under the gitignored `evals/results/discovery-value/`
tree. Review `report.md` and `ablation.md` together: the general report shows
each mode, while the ablation report rejects unmatched cells and preserves
every baseline-to-candidate task delta.
