# Concurrent main integration

## Scope

Integrate Darrow main `763bd4b5887576866bdc9d9ccc34a680acb95c11` into the issue95
extraction branch and port generic host and grading changes to Sevro. Main adds
JSON review records, native host observations, saved-document semantic grading,
the Adaptive Goal name and main-thread ownership, and current model routes.
Darrow keeps case policy; Sevro keeps generic mechanics.

The unpublished Sevro `0.1.0-rc.2` candidate is committed at `a53260b`. Its
independent review identified five blockers. Bounded repair verification cleared
all five: Git metadata aliases are excluded, plain executor recovery requires
literal command binding, turn-specific read receipts use validated recovery,
bounded recovery source facts are retained, and native goal readback proves
presence without an update notification. Publication and the Darrow pin update
remain separate steps.

## Current contract and retired assertions

Main's Adaptive Goal design keeps the original thread responsible for the goal
and delegates bounded implementation or verification separately. The old outer
owner-agent protocol is absent. Current cases compare task results, native goal
presence, actual accepted implementation routes, independently observed skill
calls, and declared user-feedback boundaries. Missing facts stay unavailable.
There is no benchmark correction or new ticket-pipeline phase instrumentation.

The following pre-merge tests asserted the removed protocol against cases whose
contracts main changed. Their source and recorded evidence remain in Git at
`da67e82efa140342ca3e41367277f8b8fc0f56ab`. They are retired from current-case
coverage rather than used to restore private owner, phase or relay metadata:

- Darrow ownership checks use complete native evidence without private task content
- Darrow translates no-agent transcript assertions into bounded native checks
- Darrow binds composed publisher reads to the accepted child
- Darrow grades accepted owner assertions from correlated native receipts
- Darrow grades the selected Codex owner route from native acceptance
- Darrow orders accepted owners around the native follow-up boundary
- Darrow rejects a recipe read or Skill call in the follow-up turn
- Darrow grades same-owner feedback across the turn boundary
- Darrow binds readiness reads to the parent before owner launch
- Darrow grades one readiness read and no owner on a non-ready result
- Darrow grades feedback to the prior owner after a real follow-up
- Darrow grades the ticket feedback relay without retaining message text
- Sevro grades an existing Darrow ownership case through its public CLI
- Claude readiness stop uses complete native calls and intact events
- Claude selected owner binds route, review, and parent handoff

Historical TSV proof readers and their separate tests remain unchanged. Generic
accepted-call, nested-reader, no-agent, guide, recipe and fixture checks remain.
Current contract checks live in `evals/domain/main-sync.test.ts`; the candidate
app-server caller check lives in `evals/sevro-candidate/direct-route.test.ts`.
The ledger and ordinary-engineering exclusions now follow current case metadata,
without treating a valid native goal call as a forbidden legacy ledger.

## Verification status

- All 393 current cases resolve through the extension.
- Documentation, type, formatting and lint gates passed for the merged candidate.
- The canonical Python gate passed for all 12 registered packages.
- Sevro's broad repaired suite reached 255 passes and one obsolete expected
  receipt shape. The expected shape now includes `recoverySources`; its focused
  host check and the independently captured host/CLI gate pass.
- The earlier broad Darrow run is diagnostic evidence: 482 passes, 39 failures,
  and seven errors, including stale contracts and timeouts. It is not a passing
  final gate. The frozen and installed archive attempts were stopped after these
  failures were identified.
- The reviewed installed `rc.2` archive passed 509 Darrow tests with zero failures
  and 4,875 assertions. The archive SHA-256 is
  `8387f3f09565d786c63acc84f292660a2a12559860b3fd108270ff929240372c`.
- Independent Darrow review passed Standards and identified two Spec blockers:
  Claude route alternatives were not graded, and malformed Claude call records
  could support absence checks. Public extension regressions drive their repair;
  matching Claude routes use sourced Agent completions, malformed facts remain
  unavailable, and shared required evidence preserves both host alternatives.
  The review also identified stale documented caller defaults, now corrected.
  Bounded repair verification and the merge milestone remain pending.

Use the frozen pin gate for published `rc.1` and the candidate gate for `rc.2`,
as documented in [eval development](../../docs/eval-development.md). No pushes,
PRs, tags, npm publication or live benchmark conclusions follow from these checks.
