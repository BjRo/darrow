# Artificer account usage policy

Status: implementation, deterministic validation and focused management smoke
checks complete. The production installation and completed old delivery remain
untouched.

## Accepted change

The user approved normal ChatGPT account usage, including available credits,
with Codex enforcing account availability. Artificer must not purchase credits,
change billing settings or switch to API-key billing. The user also instructed
us to leave the completed old delivery alone.

Artificer 0.3.0 removes the subscription-only allowance probe. Setup now requires
`--accept-chatgpt-account-usage` and saves `account_usage_accepted`. Old grants
are not automatically converted into broader spending authority. The skill,
operations reference, README and ART-C10 describe the same policy. A user who
requires zero paid usage still needs that requirement resolved before enabling.

Native ChatGPT authentication, host version checks, access-failure retention,
ownership, model routes, capability boundaries and repair limits remain unchanged.
No production execution deadline, watchdog, retry loop or billing control was
added. The opt-in transport probe now uses the same account policy without its
former test-only credit exception; its experiment deadline remains test-only.

## Deterministic evidence

1. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_cli_scheduler.py -q -k init_dispatch`:
   the accepted account-usage flag was rejected because the old no-credits flag
   was still required.
   Green — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_cli_scheduler.py -q -k init_dispatch`:
   1 passed after replacing the setup flag.
2. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_account_delivery.py -q --tb=short`:
   both worker-process scenarios stopped at the old paid-credit refusal, with
   included allowance remaining and with it exhausted.
   Green — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_account_delivery.py -q --tb=short`:
   2 passed after removing the subscription-only launch gate. The external host
   fixture reaches its intended readiness result; the original thread and archive
   survive. No real GitHub effects or credit purchases are involved.

The final `bun run check:python --package plugins/automation/darrow-artificer/backend`
passed all 159 tests, strict typing, formatting and lint, with 99.19% statement
and 96.82% branch coverage. The deleted account-policy tests covered the removed
restriction; this count is not a comparison of live reliability with 0.2.0.
Fresh immutable installation, documentation validation and `git diff --check`
passed. The generic Codex skill validator rejects the existing Claude-specific
`disable-model-invocation` frontmatter; Darrow's cross-host documentation validator
accepts it. The explicit-only policy was preserved.

An earlier package gate exposed an existing test's startup race: its 50 ms
protocol deadline also applied to launching the fake host, so it could expire
before the target unanswered request. The test now applies the short deadline
only when sending that request. Production protocol timeouts did not change.
An initial fixture complexity lint failure was also corrected before the final
gate. These failures are retained here rather than presented as clean first runs.

## Focused live evidence

Candidate evidence is retained separately from the
[main-thread migration](artificer-main-thread-2026-10-04.md) under
`evals/results/artificer-account-usage-2026-10-05/`. `inputs.json` identifies the
0.3.0 snapshot and file hashes, based on checkpoint `9b985c37`. The owning
directory remains `darrow-artificer` for the explicit invocation namespace.

The bounded scope is one Codex trial each for account-usage explanation,
zero-paid-usage requirements, status, ambiguous cancellation and revocation.
Candidate and semantic grader use `gpt-6-luna`/`medium`, threshold 100%, passive
owner observation. These are management smoke checks, not fresh native delivery
or end-to-end ticket-to-PR trials. Earlier results and failures remain separate.

The initial account-usage trial passed activation and repository checks but
failed its semantic grade. Its response correctly allowed the stated account,
explained credit usage after included allowance and warned of possible cost.
The assertion additionally demanded a recital of purchase, billing-change and
API-key prohibitions and account availability. Those omissions did not violate
the requested explanation or public contract. This was an eval expectation
defect; no skill or runtime change followed it.

The corrected assertion checks the requested account decision and excludes
contradictory billing advice. `candidate-2/` preserves this expectation revision
with byte-identical product instructions and runtime. Regrading the retained
valid response passed; a counterexample insisting that all credits must be
removed failed. These grading checks are not fresh behavior trials. The original
failed result and snapshot remain intact.

One independent read-only pass found no material account-policy defect. That
source review did not catch the assertion overreach exposed by the live response.

The first revocation attempt was interrupted by the invoking shell tool's
120-second timeout. Attempt `28677af3-e53a-40d6-8108-8f9f27ba702b` retained no
completed trial; its task outcome is unknown. The runner process was confirmed
ended before retrying the unchanged frozen case through a managed shell session.
This is an observation-tool interruption, not a production delivery deadline or
evidence that revocation failed. The original attempt remains separate.

### Completed results under corrected expectations

| Case                        | Task | Activation | Candidate time |
| --------------------------- | ---- | ---------- | -------------- |
| Accepted account usage      | 1/1  | 1/1        | 10.4 s         |
| Zero-paid-usage requirement | 1/1  | 1/1        | 17.9 s         |
| Status                      | 1/1  | 1/1        | 37.5 s         |
| Ambiguous cancellation      | 1/1  | 1/1        | 37.2 s         |
| Revocation, unchanged retry | 1/1  | 1/1        | 52.9 s         |

These five completed smoke trials passed task and explicit activation checks.
The interrupted revocation attempt remains unknown; the original account-usage
grade remains failed under its overly strict expectation. Neither is replaced
or pooled into this table. One trial per case is bounded smoke evidence, not an
n:5 reliability claim for any individual case.

The rendered invocation was verified as `$darrow-artificer:manage-artificer`
against the snapshot manifest. All current plugin files match the corrected
snapshot hashes. The only difference from the initial snapshot is the account
explanation's eval proposition. No runtime, skill, host route or shared runner
change was made in response to that grading failure.

## Remaining rollout

The account-policy change is ready for installation. The existing production
installation has not been upgraded or scheduled, and no real ticket was admitted
as part of these checks. One real ticket-to-PR smoke remains the next rollout
check after installation and configuration. The user instructed us to ignore
the completed historical delivery; no reconciliation or claim cleanup was run.
