# Layer responsibilities and composition contracts

This is the adopted disposition of the architecture recommendations in
[issue #103](https://github.com/BjRo/darrow/issues/103). It defines behavioral
boundaries, not a capability registry or a sequence every task must traverse.

## Responsibilities and decision ownership

| Responsibility | Owns                                                                                                      | Evidence supplied to consumers                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Foundations    | Reliable repository context, accepted decisions and policy, reusable skills                               | Ordinary instructions, specifications, decisions and skills; repository artifacts remain useful after the producing plugin is removed |
| Capabilities   | A focused operation and how it establishes its promised assurance                                         | Inputs inspected, effects performed, result, evidence and operation-specific refusal                                                  |
| Orchestration  | Goal framing, workflow and required assurance selection, one execution owner, continuation and completion | Bounded authority and acceptance contract; owner-sourced verification, findings and effects                                           |
| Task recipes   | A familiar complete outcome and its explicit permission envelope                                          | One delegated outcome with preserved authority and completion requirements                                                            |
| Automation     | When eligible, explicitly authorized work may start under admission and capacity rules                    | Local Artificer supplies a grant-bound entry; task recipes and the original native owner retain engineering execution                 |

Foundations and capabilities support several responsibilities directly. A user
can assess readiness or create a commit without a recipe or orchestration.
Evaluation and observability sit alongside all responsibilities: they assess
activation, outcomes, authority preservation and cost without granting execution
or publication authority. Host conversation and repository/tracker/forge state
provide evidence; Darrow adds no lifecycle ledger.

Recipes make recurring grants understandable and consistent, rather than being
only shorthand. `ticket-to-pr` still delegates once: it chooses no workflow,
model, branch name, review policy or verification command and does no preflight.

## Shared handoff rule

1. **LC-C1 — Behavioral compatibility.** Advertised intent identifies a candidate,
   not proof of compatibility. Before a bound operation becomes due, the caller
   must establish that its prerequisites, authorized effects, required result
   evidence and stop conditions fit the enclosing outcome. A compatible replacement
   may use different names and mechanics; it must preserve these observable
   promises. Resolve a known mismatch before mutation. Do not bypass a refusal by
   reimplementing the same operation through raw tools or expanding authority.

2. **LC-C2 — Continuation ownership.** Capabilities stop their own operation and
   return evidence. The enclosing owner chooses authorized investigation, a human
   question, an evidence-backed retry, or termination. It cannot waive a required
   gate, invent a decision, retry unchanged deterministic failure, or treat a
   successful suboperation as new authority. The parent handles preflight until
   launch; after launch, the same engineering owner retains continuation. Capability
   results do not themselves terminate or replace that owner.

3. **LC-C3 — One policy owner.** Recipes define outcomes and permissions;
   orchestration selects assurance, feedback and repair policy; capabilities execute
   operations and return their assurance evidence; foundations preserve accepted
   policy. A stronger explicit user or repository rule constrains these choices.
   Readiness owns assessment, not reassessment scheduling. Verification combines
   selected assessment evidence; review owns its findings. Neither owns the
   enclosing repair budget. Confirmation of a missing material choice belongs
   to the owner; established authority survives handoff. Each capability reports its
   operation, the owner reports overall completion, and the recipe relays that result.

## Adopted operation contracts

Verification is a capability-level assurance coordinator under the
[verification contract](verification.md). Within a selected operation, compatible
independent code review is required; optional QA and evidence presentation are
future separately selected extensions. Verification binds evidence to every
material originating criterion and returns an initial or closed follow-up
conclusion. Review owns independent findings and repair judgments. The active
owner alone owns implementation, combined repairs, the shared budget,
continuation and overall completion. This boundary does not change which
engineering goals select assurance or add a second lifecycle controller.

5. **LC-C5 — Combined verification, shared repair.** Adaptive delivery binds
   verification and its compatible required review before owner launch when
   assurance is selected. The owner supplies successful current required checks,
   the candidate, originating criteria, constraints and existing evidence.
   Verification collects every selected assessment result before returning
   combined eligible blockers. One repair attempt is one owner effort addressing
   those combined blockers, followed by refreshed checks and fresh closed-set
   verification; provider count never multiplies the budget. The default maximum
   is two attempts in total, with explicit finite overrides and the strictest
   invocation, time, token and authority limits preserved across handoffs.
   Complete finding and target history travels with each follow-up. Clear current
   evidence ends repair; further attempts require material progress and remaining
   budget. Missing, stale, inconclusive, unchanged or oscillating required evidence
   cannot clear completion or remaining publication. A new comprehensive
   assessment cannot reopen findings or reset this budget. The parent only
   preflights, launches and relays; no second owner or ledger is introduced.

| Boundary                      | Prerequisites and effects                                                                                                                                                                        | Result evidence and refusal                                                                                                                                                                                 | Continuation owner                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Readiness gate                | Explicit assessment or required gate; authoritative inputs; read-only                                                                                                                            | Complete verdict, basis, quality bar, findings and smallest next action; non-ready forbids implementation                                                                                                   | Caller may resolve findings within authority, then obtain required ready evidence; same owner after launch                    |
| Ordinary PR creation          | Committed feature branch and creation/push authority                                                                                                                                             | New URL/head/base/shape, or existing-PR observation without push; an existing URL proves identity only                                                                                                      | Caller decides next action; a creation refusal is never permission to publish updates                                         |
| Authorized PR reuse           | Explicit authority to publish to/reuse an existing PR, exact intended commit, repository, branch, base and shape                                                                                 | Exactly one open same-repository PR; non-force push when needed; observed remote and forge head both equal the intended commit; mismatch or unavailable evidence refuses completion                         | Owner observes partial effects before retry, preserves exclusions and obtains missing authority or evidence                   |
| Reviewer evidence publication | Ticket or verification contract requires reviewer-facing evidence; enclosing explicit Ticket-to-PR authority binds one operation to its exact current-repository PR and intended verified commit | Focused publisher preflights and reconciles one top-level comment; returns published/existing with candidate-bound identity, URL and attachments, or partial/ambiguous/refused with effects and uncertainty | Owner stops completion on changed head, partial, ambiguous or refused; no recipe retry, recovery or generic comment authority |
| Recipe completion             | Ticket acceptance and selected assurance satisfied for the intended committed content                                                                                                            | Owner supplies URL, repository, head/base, draft state and intended/published commit evidence for one PR                                                                                                    | Recipe relays; no post-goal inspection or repair                                                                              |

4. **LC-C4 — Published content.** A reused URL alone never satisfies delivery. The
   owner must tie final verification to the intended commit and confirm that the
   remote branch and open PR contain that exact commit as their current head, with
   the requested base and shape. New commits invalidate earlier publication
   evidence. A successful push followed by an unavailable/stale forge observation
   is an incomplete publication result with the push disclosed, not a second-PR
   fallback or a reason to force-push.

## Recommendation dispositions

1. **Adopt caller-owned continuation.** Replace readiness's instruction to
   terminate its enclosing goal. Its existing read-only report already contains
   the finding and next action the owner needs. Preserve the prohibition on
   implementing a non-ready request. Preflight still launches no owner until
   ready; post-launch findings return to the retained owner.
2. **Adopt explicit behavioral compatibility and publication evidence.** Keep
   ordinary `create-pr` duplicate handling because its `dup-stop` eval and
   deterministic tests promise no push on an existing PR. Add an explicitly
   authorized reuse path and content verification, preserving that default and
   avoiding implicit updates under a creation-only request.
3. **Adopt one owner per policy decision.** Keep the thin recipe in the current
   `ticket-to-pr` specification and one owner in `adaptive-delivery`; their existing
   delegation and feedback evals establish these boundaries. Align handoffs
   rather than moving preflight or repair into the recipe. The broader adaptive
   fidelity work in #102 remains separate; this change covers composition and
   material-scope readiness continuation only.
4. **Require a deliberate automation contract.** The opportunity research alone
   grants no authority. Local Artificer supplies a saved recurring grant and
   deliberate recipe entry under its local contract. A scheduler cannot infer
   authority from ticket text or impersonate a current-thread human invocation.

## Automation contracts required before shipping

Every authorized automation entry must define and preserve all of the following:

- **Recurring authority and entry:** who grants it, eligible repository/ticket
  scope, allowed effects, duration, revocation and per-run provenance. A scheduler
  cannot masquerade as current-thread recipe invocation; a deliberate authorized
  entry must preserve the exact outcome and permissions into orchestration.
- **Admission and duplicate work:** eligibility, stable work identity, atomic
  claim/conflict semantics across overlapping triggers and existing owners/PRs,
  and authoritative evidence for deciding a claim may be reclaimed.
- **Capacity:** reservation/release semantics, limits and whether owners waiting
  for a person consume capacity; waiting is not completion or silent expiry.
- **Human handoff:** where questions reach a person, how replies target the same
  owner, what revocation or abandonment means, and how unavailable continuation
  is surfaced without launching duplicate work.
- **Reconciliation:** scheduler, tracker and forge observations after ambiguous
  effects, crash recovery, stale evidence and conflict handling before retry.
  A timeout alone cannot prove an owner ended or a publication failed.

Local Artificer implements these requirements through the bounded
[local admission contract](artificer.md). Its small grant/reservation records
correlate native execution; they do not track engineering phases or create a
general queue, workflow database, or execution controller. GitHub Actions
execution remains separate and must establish its own authentication and
cross-job restoration evidence.

## Composition evidence

Focused cases must exercise readiness finding → authorized resolution → ready
evidence → same-owner continuation, existing PR plus additional local commits →
verified publication, and a compatible replacement capability → the same recipe
outcome and authority envelope. Counterexamples include a stale forge head, a
divergent remote, creation-only authority, and a capability that advertises the
intent but returns only a URL. Deterministic mechanics and live composition
trials are separate evidence; neither a fixture dry run nor a prose contract is
proof of the composed behavior.
