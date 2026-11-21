# Darrow Review

Review one bounded change against repository standards and the request that
caused it. Fresh read-only reviewers assess those questions independently;
bundled tools validate their evidence and combine the results.

Review is explicitly requested, either directly or as a selected clause in a
larger goal contract. The plugin does not trigger merely because an agent edited
code.

## Session reminder

This plugin includes a `SessionStart` hook that improves automatic selection for
matching review and repair-verification requests and reminds the coordinator to
launch its independent reviewers. Trust the hook to enable its session reminder.
The reminder does not start work or grant additional authority. If automatic
selection is missed, invoke `code-review` explicitly.

Codex uses Bash on Unix and PowerShell on Windows. Claude has its own Bash hook
registration. Live Claude and Windows hook execution remain unverified.

Coordination runs in the requesting session when its route is at least
GPT-6.1 Sol/medium (Codex) or Sonnet 5.5/medium (Claude). Otherwise one
coordinator on that route runs the review. Readers always start fresh.

## What it provides

### `code-review`

Review a PR, branch, fixed-point diff or selected working-tree changes. The
skill pins the base, target and changed files, captures applicable checks, and
asks fresh readers to assess repository standards and the originating request.
The response explains the verdict, findings, evidence, risks and next action
inline. Complete JSON and Markdown records remain saved for follow-up.

Each finding names the failure, source, evidence, suggested repair and observable
resolution. Repair guidance is advisory; another implementation can satisfy the
same requirement. A reviewer who cannot recommend a repair records that limitation.

After comprehensive review, the same skill verifies authorized repairs against
the original finding set. It retains original, prior and current targets, attempt
history and direct repair-caused regressions. The result is `clear`, `continue`,
`no_progress` or `blocked`. Unrelated findings stay outside that set, and unresolved
advisories do not block convergence. A defect missed initially is considered later
only if the repair caused it.

For example, ask "Review all uncommitted changes." The default report includes
findings directly in the session:

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

Request "raw v3 JSON" only when an integration needs `darrow-review-result-v3`
or `darrow-review-verification-v3`. Composition does not select JSON mode.
A goal owner requests independent review of a pinned change through advertised
intent, reads the report and retains continuation authority. Content changes
invalidate prior clearance and require verification of the current target.

### `review-scope`

Snapshots the complete requested change, including applicable staged, unstaged,
renamed, deleted and untracked paths. Every reader uses that same packet.
For repair verification, `prepare --prior-manifest <absolute-scope.json>` derives
the prior base when `--base` is omitted and refuses an explicitly different base.

`prepare --report-terminal` saves blocked JSON and Markdown for scope exits 2,
3 or 4 without launching readers. Use `--spec-source` for an available originating
source. If preparation fails before creating a manifest, `allocate-terminal
--repo <repo>` creates a private directory and terminal manifest.

### Review state and cleanup

Evidence lives under `~/.darrow/reviews` on Linux and macOS or
`%LOCALAPPDATA%\Darrow\Reviews` on Windows. `DARROW_REVIEW_STATE_DIR` selects a
nonempty absolute override. Repositories and worktrees have separate directories;
each review has its own run. The scope command returns the absolute manifest.
Use `review-scope locate --repo <repo> --target <fingerprint>` to find one prior
manifest when its path was not retained.

A review invocation prunes unpinned runs unchanged for 30 days. A retained
verification keeps the prior runs it references. `review-scope pin --manifest
<absolute-scope.json>` retains a run and its dependencies; `unpin` restores normal
retention. `prune --all` applies the 30-day rule immediately, while
`--older-than-days 0` removes all unpinned runs without retained dependents.
Expired follow-up evidence produces a refusal. Older `.git` review directories
are not migrated or deleted automatically. Terminal manifests also support pinning.

The disposable UV environment cache is separate from review evidence. It lives
under `~/.darrow/cache` or `%LOCALAPPDATA%\Darrow\Cache`.

### `review-result`

Prepares reader inputs, validates comprehensive and repair records, and derives
aggregate results. Judgment stays with the independent readers.

- `read-evidence --repo <repository> --input <supplied-path>` reads an exact JSON
  file, including extensionless files. Relative paths resolve against the repo.
  Unreadable files, invalid JSON and directories produce concrete errors.
- `original-findings` returns complete findings with stable cross-axis keys.
  `validate-original` checks their identity, source, evidence and repair guidance
  against the original result. Records without the guidance fields introduced
  in 0.9.0 are refused. Complete external handoffs need no original artifact.
- `prepare-reader` binds the axis instructions, scope, sources and captured
  checks into an immutable input. `read-reader` validates it before judgment.
  Codex's `--route-record` adds complete native `launch` arguments; the launch
  still needs actual acceptance evidence.
- `reader-feedback` allows one diagnostic correction by the same route-bound
  reader. Persistent input or record errors remain evidence gaps.
- `finalize` validates retained readers and checks, preserves their judgments,
  and saves `result.json` plus `review.md`, or `verification.json` plus
  `verification.md`. `--present` also prints the human report.

For the full fields, flags, draft interface and exceptional paths, read the
[result protocol](skills/code-review/references/result-protocol.md),
[reader input workflow](skills/code-review/references/reader-inputs.md), and
[repair verification](skills/code-review/references/fix-verification.md).
The human renderer preserves identifiers and paths, including single underscores.

### Reviewer routes

Fresh standards, request-conformance and repair readers use explicit model and
effort settings. Defaults are `gpt-6.1-sol`/`xhigh` on Codex and
`claude-opus-5-5`/`xhigh` on Claude. Override them in `.darrow/config.json`:

```json
{
  "reviewers": [
    {
      "host": "codex",
      "harness": "codex",
      "provider": "openai",
      "model": "gpt-6.1-sol",
      "effort": "xhigh"
    },
    {
      "host": "claude",
      "harness": "claude",
      "provider": "anthropic",
      "model": "claude-opus-5-5",
      "effort": "xhigh"
    }
  ]
}
```

Review owns `reviewers`; it syntax-checks but otherwise ignores `routes`.
An absent or empty section, or an omitted host, keeps the bundled policy.
Invalid, duplicated, unsafe or mismatched routes stop review without substitution.

Overrides must belong to the shipped strong-route catalog. Codex allows
`gpt-6.1-sol` and `gpt-5.6-sol` at `high`/`xhigh`/`max`, and `gpt-5.5` at
`high`/`xhigh`. Claude allows `claude-opus-5-5`/`xhigh` and
`claude-sonnet-5-5`/`high`. Another Claude tuple needs its matching plugin agent.

Codex binds accepted native spawn evidence to the child, exact route, fresh
context and axis. Claude uses a foreground exact-tuple plugin agent with no
per-call model alias, and verifies the child transcript's model and effort on
every assistant turn. Conflicting overrides, substitutions, background launches
or unverifiable routes block that axis. The
[Codex reader instructions](skills/code-review/references/codex-readers.md) and
[Claude reader instructions](skills/code-review/references/claude-readers.md)
own the launch protocol.

### `review-route`

Selects reviewer policy, writes selection and application records at absolute
caller-supplied paths, and binds each application to its axis and actual child ID.

### `review-claude-verify`

Checks one completed `agent-<id>.jsonl` transcript by exact ID. Missing, partial,
malformed, duplicated or inconsistent route evidence is refused.

### Review references

The skill bundles its axis prompts, design-smell baseline and result protocol.
It requires no other installed plugin.

## Assessment correction

To correct an erroneous assessment at unchanged code, supply
`assessment_correction` with the concrete error and new evidence. Bind the latest
completed result by checksum, retain all findings and target history, and obtain
fresh judgments and successful current checks. The previous artifact stays intact.

Only resolved evidence can clear. Repeated unresolved conclusions remain blocked
or no-progress. A retained blocked verification with no original findings can be
corrected without inventing a finding. Correction neither consumes nor resets
the enclosing implementation repair allowance.

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
uv run --quiet --no-project /absolute/path/to/darrow-review/backend/scripts/run_locked.py review-scope prepare --repo /absolute/repo --base HEAD --target WORKTREE
```

The public entrypoints are `review-scope`, `review-result`, `review-report`,
`review-check`, `review-route`, `review-claude-verify`, and `claude-provider`.
They retain their subcommands and JSON protocols; the old `bin/` runtime is
removed. Runtime dependencies are empty; development tools are separately
locked. All deterministic plugin tests live in the Python package, including
CLI contracts, exact report fixtures, and quoted-path command execution.
Validate with `bun run check:python` and the copied-artifact probe:

```sh
uv run --quiet --no-project plugins/capability/darrow-review/backend/scripts/run_locked.py python plugins/capability/darrow-review/backend/tests/fresh_install.py
```

## Installation

Install `darrow-review@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).

## Usage

Ask for the operation:

> Review all uncommitted changes.

To select it explicitly, choose `code-review` from Codex's `$` skill menu,
or use `/darrow-review:code-review` in Claude Code, followed by your request.

## Expected result

The session response leads with its verdict and next action, then explains the
findings, relevant checks, risks, and scope inline. It may group resolved items
and omit repeated history. Complete validated evidence artifacts remain saved,
and product files stay unchanged.

## Troubleshooting

Check the returned assessment for blocked or incomplete review axes. The
coordinator launches reviewers through native tools; the session reminder cannot
override host restrictions. When the host permits subagents requested by a skill,
the review skill's explicit reader requirement satisfies that condition. An
unconditional prohibition still blocks review.

Unintended worktree changes remain an unresolved issue in Codex review sessions.
Inspect the working tree after review.

A missing route, unverifiable child identity, invalid scope, or malformed result blocks review. Preserve the evidence and correct the exact input; selection alone does not prove a route ran.
For a missing skill or host error, follow the
[installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md).
Report the plugin and host versions, invocation and error. Omit credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
