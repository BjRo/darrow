# Local Artificer delivery evidence — #157

This record separates deterministic acceptance checks, live native observations,
and remaining limits. The contract is [Local Artificer](../specs/artificer.md).
It does not establish GitHub Actions support.

## Candidate and boundaries

The new `darrow-artificer` plugin is explicit-only on both hosts. Its contained
UV package handles local admission, model-free GitHub observation, native CLI
processes and encrypted archives. The existing ticket recipe gains a deliberate
saved-grant unattended entry; the recipe still delegates once and owns no
engineering workflow. No schedule was enabled for the Darrow repository.

Supported execution host: macOS, Codex CLI `0.154.0`, normal persistent ChatGPT
Pro login. Parent model/effort defaults are `gpt-5.6-terra`/`medium`; the selected
engineering owner keeps the route chosen by adaptive delivery. Both routes are
checked against native records on continuation. Other CLI versions fail closed.

## Mechanical acceptance

`bun run check:python` passed across all registered packages. The Artificer
package's final focused run passed 130 tests, Ruff and strict mypy, with 99.26%
statement and 96.83% branch coverage. The same 130 tests also passed in isolated
Python 3.10.20, 3.11.15 and 3.12.13 environments; the primary quality run used
Python 3.13.14. Tests include:

| Contract                      | Observable evidence                                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Independent admission limits  | WIP 5 with two claims at starts 1/3, full/zero WIP, fewer eligible issues, invalid values, and property-based allowance bounds                                   |
| Shared lock and ownership     | Two actual CLI tick processes, one common-repository flock, five total reservations, no duplicate issues, persisted correlations before external effects         |
| Failed/ambiguous effects      | Reservations retained, no same-activation replacement, no automatic failed-continuation replay                                                                   |
| Human loop                    | Exact multiline payload, write authorization, ordinary/duplicate/competing/wrong-target replies ignored, WIP-zero continuation, stale resume comments rejected   |
| Cancellation and interruption | Two real process groups, only target stopped; orphaned descendants keep execution outstanding; reused PID cannot authorize killing                               |
| Completion                    | Open PR retains capacity; closed PR releases only after execution ends and exact repository/branch identity matches; no readiness reapplication                  |
| Native recovery               | Retained parent/child identities and routes required; no summary fallback; original archive restoration; missing/expired state retains ownership                 |
| Subscription boundary         | Login/version/provider checks; model API environment removed; credit-bearing, exhausted, unknown and non-Pro account observations refuse launch                  |
| Archives                      | Authenticated encryption, wrong-key failure, credential exclusion, safe restore paths, five-day default, expiry retains claims, regenerable virtualenvs excluded |

The GitHub tests use protocol fixtures. They do not post to real issues or
exercise a new real ticket-to-PR publication end to end.

## Actual native restoration

Run from the new plugin's `backend`:

```sh
uv run --quiet --frozen --no-dev python tests/live_native.py
```

On 2026-09-19 this passed with two distinct Codex processes and an encrypted
archive restore between them. The original native home was moved aside, the
archive restored at its original absolute location, and credentials relinked
separately. The same child recalled a private random marker not supplied in
the continuation message.

- Parent: `01a0ba3c-7c79-7933-97c6-f411fd6e971b`
- Owner: `/root/continuity_owner`
- Child: `01a0ba3c-9f0a-7a41-ab95-dec2246c0327`
- Parent and child before/after: `gpt-5.6-terra`, `medium`
- Evidence directory: `/var/folders/_b/yvzxqsys46l91yf5dtlk7q9w0000gn/T/darrow-artificer-native-kbm1rf_k`

Earlier probes exposed inherited parent metadata in child rollouts, a default
parent-route change when resume omitted routing, and pre-1980 native file
timestamps. The implementation now binds exact native IDs, pins the parent
route on every invocation, and archives those timestamps safely.

## Actual scheduled execution and reply

```sh
uv run --quiet --frozen --no-dev python tests/live_schedule.py
uv run --quiet --frozen --no-dev python tests/live_delivery.py
```

The copied-artifact schedule probe passed: launchd loaded the absolute frozen
entrypoint with `StartInterval=900`, ran a model-free paused activation without
a terminal, and reported exit zero. It removed its temporary schedule afterward.
Evidence: `/var/folders/_b/yvzxqsys46l91yf5dtlk7q9w0000gn/T/darrow-artificer-launchd-eroltftn`.

The final copied-artifact rerun also passed at
`/var/folders/_b/yvzxqsys46l91yf5dtlk7q9w0000gn/T/darrow-artificer-launchd-kia2wb_u`.

The scheduled delivery probe then used a real ChatGPT-authenticated Codex worker
with an isolated transport-only recipe and filesystem-backed GitHub fixture.
An initial owner question was published to that fixture. At WIP zero, a later
launchd activation consumed one explicit reply and restored the same parent and
child. The returned question preserved the complete whitespace-bearing payload.

- Parent: `01a0ba61-0849-7be1-ac14-69cc8b33e984`
- Owner: `/root/transport_owner`
- Child: `01a0ba61-2b34-7322-8a7c-4e22df4a0c58`
- Parent and child: `gpt-5.6-terra`, `medium`
- Evidence: `/var/folders/_b/yvzxqsys46l91yf5dtlk7q9w0000gn/T/darrow-artificer-delivery-zlwaexle`

The first delivery probe had an assertion race against launchd's previous exit
record; waiting for the new question identity fixed the test. No product retry
was used to hide that failure. All temporary launchd jobs were removed.
Desktop was not deliberately closed during this editing session; execution was
detached and had no terminal or Desktop API dependency. A physical Desktop-close
trial remains an explicit observation limit, not an observed UI action.

## Included-usage evidence

The native model-free `account/rateLimits/read` observation reported Pro,
`hasCredits=false`, `unlimited=false`, zero credit balance and
`ordinaryUsageAllowed=true`. Both real scheduled invocations passed that gate.
The adapter refuses non-Pro, unavailable, credit-bearing or exhausted accounts,
uses forced ChatGPT authentication, and offers no purchase/API fallback.
Setup also requires the human's explicit confirmation that automatic credit
reload is disabled. Changing that external account configuration invalidates
the setup premise; a login alone is never offered as proof of zero extra cost.
No deliberate real subscription exhaustion or credit purchase was performed.
Native token-refresh writes were not forced or observed: initial credential
linking, archive exclusion and ordinary persistent login were tested, but that
is not a token-refresh integration claim.

## Skill and documentation evidence

Focused Codex trials (`gpt-5.6-terra`/`medium`, one trial per case) passed for
missing operation, missing authority, subscription refusal, unavailable-owner
recovery refusal, ambiguous cancellation, status and revocation. All seven prepared in dry
validation. The new ticket recipe unattended-grant trial passed with receipt
assertions at the actual delegation seam. Dry validation's missing receipt file
is expected before the participant runs; it is not behavioral evidence.

Initial cancellation fixtures lacked state and then contained contradictory
state/detail. They were repaired before the passing trial. The first unattended
eval incorrectly graded the final summary instead of the delegated request;
the revised recorder checks the actual boundary. The guide's first recipe trial
exposed an incomplete source snapshot (new runtime omitted); the snapshot now
contains public Artificer sources but not hidden tests or this evidence record.
The corrected recipe, layer and visual guide trials passed on both Codex and
Claude Code. Native Claude Artificer status, recovery-refusal and revocation trials passed.
The ordinary Codex recipe options-delegation regression passed.

A diagnostic Claude unattended-recipe trial refused the plain-text grant receipt.
The local machine execution contract supports Codex, so unattended evaluation is
now explicitly Codex-only; ordinary human recipe invocation and Artificer
management remain available on both hosts. No unattended Claude support is claimed.

## Independent challenge

A fresh-context, read-only reviewer challenged the artifact and evidence without
Git/GitHub operations. It found two product defects: archive expiry disabled
later PR completion, and cancellation failure could report a false cancelled
state. Both were repaired and verified with focused regressions. It also found
that two read-only evals left fixture state untracked. Those fixtures now commit
state and check `git diff HEAD`; both executed Codex reruns passed. No material
finding remains in that bounded artifact review.

Revocation initially changed state correctly but omitted the scope of disabled
work from its summary. The skill now explicitly reports that future admissions
and continuations are disabled without cancelling existing execution or effects.

## Final checks and limits

Both finished skills passed the frozen skill inspector. Both Claude plugin
manifests passed `claude plugin validate`; Codex CLI has no corresponding
validation subcommand, so discovery is evidenced by native explicit trials and
the repository's paired-manifest checks. `bun run check:docs`, `bun run lint`,
`bun run typecheck`, `bun run lint:shell` and the seven documentation-check tests
passed. The updated guide fixture passed on Bash 3.2.57; Bash 5 was unavailable.

The GitHub protocol follows the official
[issue dependency endpoint](https://docs.github.com/en/rest/issues/issue-dependencies)
and [collaborator permission endpoint](https://docs.github.com/en/rest/collaborators/collaborators).

These are focused samples, not a statistical reliability guarantee. Native
state formats and account protocol are intentionally version-pinned. A fresh
archive/live probe is required before supporting another Codex version.
