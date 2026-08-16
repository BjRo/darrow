# Darrow Review

This plugin provides independent, read-only review of one precisely bounded
change. It separates two questions that are often blurred together: whether the
change follows repository standards, and whether it fulfills the specification
or request that caused the work. Fresh reviewers evaluate those axes in
isolation, then deterministic tooling validates and aggregates their evidence.

Review is explicitly requested, either directly or as a selected clause in a
larger goal contract. The plugin does not trigger merely because an agent edited
code.

## What it provides

### `code-review`

Reviews a pull request, branch, fixed-point diff, or selected working-tree
layer. It pins the base, target, and complete changed-file set before review;
runs applicable deterministic checks; delegates standards and specification
analysis independently; then returns one complete Markdown report with only
evidence-backed findings. The validated `darrow-review-result-v1` remains the
canonical artifact beneath the review scope and is returned only when explicitly
requested as raw machine format.

After that comprehensive review, the same skill can fix-verify authorized
repairs against its closed original finding set. The additive
`darrow-review-verification-v1` binds original, prior, history, and current
target fingerprints and a checksum-linked prior verification chain; records
resolved, unresolved, or blocked attempts; ties direct repair-caused
regressions to attempted findings in a mechanically pinned prior-to-current
repair delta; and derives `clear`, `continue`, `no_progress`, or `blocked`.
Fix-axis records and the aggregate are validated independently, prior
regressions cannot disappear between rounds, and a failed check must be scoped
as a repair-caused regression. Unrelated findings cannot enter the closed set,
and unresolved advisories never gate convergence.

Example: _“Review all uncommitted changes.”_

The default response starts with the decision a human needs, then keeps the
full traceability later in the same report:

```md
# Code review — FAIL

**Verdict:** fail · **Findings:** 1 (1 blocking, 0 advisory)

## Findings

### 1. HIGH — BLOCKING (Spec)

- **Location:** <code>src/rate.js:1</code>
- **Source:** <code>Originating requirement: RATE_LIMIT must equal 2</code>
- **Evidence:** The changed export remains `1`.

## Checks

- **PASS** — <code>bash check.sh</code>: rate check passed

## Risks

- The requested rate limit remains unavailable.

## Next action

Return findings to the requester.
```

Ask for “raw v1 TSV” or “machine format” only when an integration needs the
canonical record rather than this Markdown report.

The same canonical skill supports both invocation modes. A composed review is
requested by host-visible intent—independently review this pinned code
change—without naming or assuming this plugin. It returns its normal review
report to the goal owner, which interprets the findings and outcome under its
own continuation contract. Any content-changing repair invalidates the initial
target and requires exact-target fix verification. This intentionally gives up
comprehensive rereview after repair: a defect missed initially will not be
discovered later unless the repair directly caused it.

### `bin/review-scope`

Resolves and snapshots the requested review scope. It accounts for committed,
staged, unstaged, renamed, deleted, and untracked paths as appropriate so every
reviewer examines the same immutable change packet.

### `bin/review-result`

Validates the structured findings produced by each comprehensive axis, the final
aggregate, each fix-verification axis, and additive repair-verification records.
This keeps status, severity, lifecycle identity, progress, prior-artifact
continuity, evidence, and target binding mechanically consistent while leaving
code judgment to the reviewers.

### Review references

The skill bundles axis prompts, a design-smell reference, and the result
protocol used by fresh reviewers. These files make the two review questions
explicit without relying on another installed plugin.

## Design boundaries

- Reviewers report defects; they never edit, repair, commit, push, approve,
  merge, release, or deploy.
- Selecting review and acting on its verdict belong to the caller; the review
  capability grants no implementation or publication authority.
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
