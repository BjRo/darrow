# Darrow Review

This plugin provides independent, read-only review of one precisely bounded
change. It separates two questions that are often blurred together: whether the
change follows repository standards, and whether it fulfills the specification
or request that caused the work. Fresh reviewers evaluate those axes in
isolation, then deterministic tooling validates and aggregates their evidence.

Review is explicitly requested. The plugin does not trigger merely because an
agent edited code.

## What it provides

### `code-review`

Reviews a pull request, branch, fixed-point diff, or selected working-tree
layer. It pins the base, target, and complete changed-file set before review;
runs applicable deterministic checks; delegates standards and specification
analysis independently; and returns one validated `darrow-review-result-v1`
record with only evidence-backed findings.

Example: _“Review all uncommitted changes.”_

### `bin/review-scope`

Resolves and snapshots the requested review scope. It accounts for committed,
staged, unstaged, renamed, deleted, and untracked paths as appropriate so every
reviewer examines the same immutable change packet.

### `bin/review-result`

Validates the structured findings produced by each review axis and the final
aggregated result. This keeps status, severity, evidence, and scope mechanically
consistent while leaving code judgment to the reviewers.

### Review references

The skill bundles axis prompts, a design-smell reference, and the result
protocol used by fresh reviewers. These files make the two review questions
explicit without relying on another installed plugin.

## Design boundaries

- Reviewers report defects; they never edit, repair, commit, push, approve,
  merge, release, or deploy.
- A finding needs concrete changed evidence and an authoritative repository or
  specification source. Preferences and speculative improvements are omitted.
- Deterministic checks settle facts such as formatting, types, builds, and
  tests; reviewer opinion does not override their result.
- An empty or invalid scope is reported honestly rather than treated as a
  successful review.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
