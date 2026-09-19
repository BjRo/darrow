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

Each finding explains the failure and its cause, then carries the originating
reviewer's suggested repair, rationale, important constraints, and observable
resolution behavior or a regression test. Repair guidance is advisory: a
different valid implementation can satisfy the original requirement. When a
reviewer cannot confidently recommend an approach, the report preserves the
supported finding and explains that limitation.

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

## Next action

Return findings to the requester.

## Findings

### 1. HIGH — BLOCKING (Spec)

- **Location:** src/rate.js:1
- **Source:** Originating requirement: RATE_LIMIT must equal 2
- **Evidence:** The export is assigned `1`, so consumers receive the wrong limit.
- **Repair guidance (advisory):** Set the exported limit to 2 to restore the required value; preserve the export name.
- **Resolution evidence:** Importing RATE_LIMIT yields 2.

## Checks

- **PASS** — bash check.sh: rate check passed

## Risks

- The requested rate limit remains unavailable.
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

### `review-scope`

Resolves and snapshots the requested review scope. It accounts for committed,
staged, unstaged, renamed, deleted, and untracked paths as appropriate so every
reviewer examines the same immutable change packet.

### `review-result`

Validates the structured findings produced by each comprehensive axis, the final
aggregate, each fix-verification axis, and additive repair-verification records.
This keeps status, severity, lifecycle identity, progress, prior-artifact
continuity, evidence, and target binding mechanically consistent while leaving
code judgment to the reviewers.
`original-findings` copies the complete original finding rows with stable
cross-axis keys; `validate-original` checks a follow-up against that retained
comprehensive result, including advisory rows and exact source/evidence text,
repair guidance, and resolution evidence. The guidance fields are a paired
additive extension; legacy v1 records without them remain valid.

### Reviewer routes

Every fresh standards, specification, and fix-verification reader runs on one
explicit strong route. Bundled defaults are `gpt-5.6-sol` / `xhigh` on Codex
and `claude-opus-5` / `xhigh` on Claude. A repository can replace either host's
route in the independent `reviewers` section of the same shared
`.darrow/config.json` used by adaptive delivery routing:

```json
{
  "reviewers": [
    {
      "host": "codex",
      "harness": "codex",
      "provider": "openai",
      "model": "gpt-5.6-sol",
      "effort": "xhigh"
    },
    {
      "host": "claude",
      "harness": "claude",
      "provider": "anthropic",
      "model": "claude-opus-5",
      "effort": "xhigh"
    }
  ]
}
```

The review capability owns only `reviewers`; it syntax-checks but otherwise
ignores a sibling `routes` section. An absent or empty section and omitted hosts
retain bundled reviewer policy. An unreadable, malformed, duplicate, unsafe,
host/harness-mismatched, or host/provider-mismatched route stops review rather
than inheriting or silently substituting a model.

Repository overrides remain inside a shipped strong-route catalog so config
cannot downgrade review. Codex currently supports `gpt-5.6-sol` at
`high`/`xhigh`/`max` and `gpt-5.5` at `high`/`xhigh`. Claude supports
`claude-opus-5`/`xhigh` and `claude-sonnet-5`/`high`. Add a catalog entry and,
for Claude, its exact-tuple plugin agent before selecting another route.

Codex supplies the exact model and effort to each native subagent boundary.
Its application record is not standalone proof: the accepted native spawn
event must bind the same child ID to the exact model, effort, fresh-context
setting, and review axis. Missing native evidence blocks the reader.
Claude follows the current Claude Code strategy: an exact-tuple foreground
plugin agent pins the full model and effort together, and Agent receives no
per-call model alias. The bundled Claude catalog supports `claude-opus-5` /
`xhigh` and the supported override `claude-sonnet-5` / `high`; another tuple is
unavailable until a matching plugin agent ships. The resulting
`agent-<id>.jsonl` transcript must prove the same model/effort tuple on every
assistant turn. Retained parent telemetry joins the current Agent tool-use ID
to that exact host-reported child ID so stale transcripts cannot satisfy the
gate. Any conflicting environment override, background launch, substitution,
or unverifiable route blocks that review axis.

### `review-route`

Resolves bundled and repository reviewer policy, owns selection and application
record I/O at caller-supplied absolute paths, selects the Claude effort-specific
plugin agent from the selection record, and binds every confirmed application
to its axis and host-reported child ID.

### `review-claude-verify`

Parses one completed Claude `agent-<id>.jsonl` transcript by exact agent ID and
writes the one effective model and effort observed on every assistant turn to
a caller-supplied absolute record path. Malformed, missing, partial, duplicate,
or inconsistent evidence fails closed.

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
- Every fresh reader records exact route-application evidence; selected or
  inherited metadata alone never satisfies the boundary.
- An empty or invalid scope is reported honestly rather than treated as a
  successful review.

## When to use

Review a bounded change or verify authorized repairs against a closed finding set. Do not use it to implement repairs or as an automatic consequence of an edit.

## Hosts and prerequisites

Codex and Claude Code with native fresh-agent support; Git,
[UV and Python](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md#uv-and-python-for-plugin-helpers),
target checks, and available reviewer routes. The package supports
Linux, macOS, and native Windows. Literal check commands use Bash on Unix and
PowerShell on Windows. PR retrieval needs authenticated forge access.

Every bundled command runs through the same locked package:

```sh
uv run --quiet --frozen --no-dev --project /absolute/path/to/darrow-review/backend review-scope prepare --repo /absolute/repo --base HEAD --target WORKTREE
```

The public entrypoints are `review-scope`, `review-result`, `review-report`,
`review-check`, `review-route`, `review-claude-verify`, and `claude-provider`.
They retain their subcommands and TSV protocols; the old `bin/` runtime is
removed. Runtime dependencies are empty; development tools are separately
locked. All deterministic plugin tests live in the Python package, including
CLI contracts, exact report fixtures, and quoted-path command execution.
Validate with `bun run check:python` and the copied-artifact probe:

```sh
uv run --quiet --frozen --no-dev --project plugins/capability/darrow-review/backend python plugins/capability/darrow-review/backend/tests/fresh_install.py
```

## Installation

Install `darrow-review@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.

## Usage

An ordinary request can select the appropriate capability:

> Review all uncommitted changes.

To select it explicitly, choose `code-review` from Codex's `$` skill menu,
or use `/darrow-review:code-review` in Claude Code, followed by your request.

## Expected result

A pinned report leads with its verdict and next action, then retains findings,
checks, risks, scope, and sources. Validated evidence artifacts remain available,
and product files stay unchanged.

## Troubleshooting

A missing route, unverifiable child identity, invalid scope, or malformed result blocks review. Preserve the evidence and correct the exact input; selection alone does not prove a route ran.
For a discovery or host problem, use the
[documented installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin version, host version, exact invocation, and error
without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
