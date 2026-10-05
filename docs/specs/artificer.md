# Local Artificer

Artificer admits explicitly nominated GitHub issues to one native Codex delivery
each. Issues [#126](https://github.com/BjRo/darrow/issues/126) and
[#157](https://github.com/BjRo/darrow/issues/157) define its shared and local
acceptance. This specification defines the local implementation boundary.

## Entry and authority

- **ART-C1 — Explicit entry.** `manage-artificer` starts only when explicitly
  invoked. Both host metadata controls disable implicit invocation. Installing
  the plugin neither creates a schedule nor grants delivery authority.
- **ART-C2 — Recurring grant.** Enabling requires an exact repository, controlling
  checkout, grantor with write access, ticket scope, named ticket-to-PR recipe,
  permitted effects, and revocation command. The saved grant authorizes recurring
  reads, claim/release labels and correlation comments, question comments,
  worktrees, encrypted archives, and recipe invocation. Its recipe envelope
  permits intended commits, non-force push, and one verified PR per delivery;
  it excludes merge, auto-merge, deployment, release, and unrelated mutations.
  Activation provenance identifies the grant and each reservation. Revocation
  prevents subsequent admissions and continuations; it does not undo effects.
- **ART-C3 — Ownership.** Automation owns admission and process/storage mechanics.
  The recipe owns its permission envelope. Adaptive delivery owns readiness and
  the original main thread's native goal. That thread retains readiness,
  acceptance, decisions, bounded delegation and completion. A scheduler supplies a deliberate grant-bound
  unattended entry, never an impersonated human invocation. Failed readiness
  permits no implementation. The same main thread retains all continuation.
  The initial route is `gpt-6-sol`/`medium`; implementation and assurance routes
  remain selected by Adaptive Delivery and its bound capabilities.

## Admission and reconciliation

- **ART-C4 — Limits.** `WORK_IN_PROGRESS_LIMIT` defaults to 1 and accepts
  nonnegative integers. `MAX_STARTS_PER_ACTIVATION` defaults to 1 and accepts
  positive integers. Invalid configuration admits nothing. Under the repository
  lock, reserve `min(max(0, WIP - outstanding), starts, eligible)` issues. A
  missed tick never accumulates allowance. Lowering WIP never cancels deliveries.
- **ART-C5 — Eligibility.** Select oldest open, unclaimed issues whose current
  `artificer:ready` nomination was made by a person with write access or higher,
  and which have no unresolved GitHub blocking dependencies. Ambiguous or
  unreadable nomination/dependency evidence is ineligible.
- **ART-C6 — Reservation.** One OS advisory lock at the repository's common Git
  directory protects all admissions. One controlling installation is bound to
  that repository. Persist correlation before any GitHub write or launch;
  consume `artificer:ready`, establish `artificer:claimed`, and correlate issue,
  delivery, activation, grant, worktree and original thread. Local unreleased
  reservations and external claims occupy capacity, counted once per issue.
  Partial writes and failed/ambiguous launches retain reservations and consume
  allowance. Never admit replacement work for them during that activation.
- **ART-C7 — Completion.** Every activation reconciles replies and PR status,
  including at WIP zero. An open PR holds capacity. Normal release requires a
  verified delivery PR merged/closed and ended execution. Cancellation, failed
  readiness, interrupted/ambiguous execution or missing state retains ownership
  for human recovery. Missing labels and expiry do not release claims. A closed
  unmerged PR does not reapply readiness.

## Human loop and local execution

- **ART-C8 — Replies.** Questions are issue comments with a delivery and question
  identifier. `/artificer reply <delivery> <question>` followed by a newline and
  the answer resumes only that pending question's original owner. A write-access
  author is required. Preserve the entire answer payload. Record comment
  consumption before launch; duplicates, multiple competing answers, ordinary
  discussion and unauthorized comments never execute. Explicit
  `/artificer resume <delivery>` requests recovery after needs-attention; it
  cannot authorize a replacement owner or bypass unresolved questions.
- **ART-C9 — Native continuation.** Support must be established against an exact
  Codex version. A contained app-server client hosts the original main thread
  through native continuation. After process exit, resume its exact thread ID
  and deliver the complete authorized feedback there, preserving native history,
  goal and route. Retain an observed goal's objective across process exits and
  refuse its later disappearance or replacement. A host snapshot with no goal
  is valid before the first goal is created. Questions before goal creation
  also retain that same thread.
  Never use forks, fresh owners, summary reconstruction, synthetic continuation
  prompts or an engineering phase loop. Persist the accepted identity before
  submitting the first turn. Serialize authority checks, native resume and turn
  submission with grant revocation. Release the lock while observing execution.
  Later delivery requires observed native completion
  and a validated result with a verified PR; an intermediate final response or
  a child result cannot establish completion. Preserve malformed results, host
  errors and uncertain handoffs for recovery without automatic retries.
  Earlier separate-owner records are not converted or relaunched.
  Production execution has no overall elapsed-time limit. Observe healthy native
  continuation until completion, a user question, cancellation or a host failure.
  Individual protocol requests and process shutdown remain bounded. Experiment
  duration limits belong only to test/eval entrypoints; they never become an
  implicit delivery budget or automatic retry policy.
- **ART-C10 — Account usage.** Use persistent normal ChatGPT login and Codex token
  refresh. Force ChatGPT authentication and the OpenAI provider; exclude API-key,
  custom-provider, and API-base overrides. The recurring grant explicitly accepts
  account usage, including available credits after included allowance is exhausted.
  Credit balances and automatic reload settings do not block execution. Codex
  enforces account availability; Artificer does not impose a subscription-only
  allowance gate or promise zero additional cost. Never purchase credits, change
  billing settings or introduce API-key fallback. A stricter user requirement
  such as zero paid usage must be resolved before enabling; it is not satisfied
  by a point-in-time allowance check. An access/allowance failure retains native
  state and the claim, reports needs-attention, and cannot be restarted by a tick without an explicit
  authorized human resume. Polling itself invokes no model.
- **ART-C11 — Scheduler and cancellation.** The initial local host is macOS with
  launchd, absolute executables, no terminal dependency, and a configurable
  900-second interval. A scheduled invocation works independently of Desktop.
  Status maps each delivery ID to its issue, native identities and status.
  Cancellation stops only the target delivery's identified process group,
  retains its claim, and leaves published effects and other deliveries intact.
- **ART-C12 — Archives.** Encrypt saved native continuation state with
  authenticated encryption and a separate local key. Exclude credentials.
  `SESSION_RETENTION_DAYS` defaults to 5, measured from the latest successful
  save. Expiry removes the archive without releasing ownership. Do not silently
  restore corrupt, missing, expired or mismatched native state.
  Exclude regenerable native temporary launchers from archives; unexpected
  symbolic links in persistent state remain errors. Archive only after the host
  process has stopped so native databases and histories are settled. Restore
  executable helpers' permission bits without restoring elevated permissions.

## Evidence required

Mechanical tests cover all admission combinations, concurrent processes, partial
effects, replies while paused, competing/duplicate replies, cancellation,
completion, encryption, expiry, malformed configuration, and fresh installation.
Live Codex evidence must prove original main-thread restoration, goal, history,
model and effort after process exit. Live launchd evidence must show nonterminal
activation and the configured interval. Explicit-entry evals cover a direct
request, missing authority, status, revocation and a request to bypass recovery.
No implicit-positive activation is required. Packaging must disable implicit
selection and preserve ordinary engineering requests outside this entry.

An implementation and its mock tests do not establish native integration
acceptance. Record observed evidence and unresolved limitations separately.
