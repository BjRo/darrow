# Local Artificer

Artificer is an explicitly authorized unattended worker around a normal,
plugin-equipped Claude Code or Codex session. It owns admission and execution
supervision. Task recipes and their native session own engineering.

- **ART-C1 — Entry and authority.** Installation starts nothing. Enabling binds
  a repository, writer grantor, recurring authority, effect envelope and revocation.
  Initially invoke only `ticket-to-pr` for ready GitHub issues. Preserve recipe
  verification, commit, non-force push and PR requirements. No merge, deploy,
  release, billing changes or unrelated mutations.
- **ART-C2 — Composition.** Require Adaptive Goal, verification and review in
  the session before engineering. Other plugins (TDD, Git, tickets, etc.) are
  optional; use applicable installed capabilities and retain their refusals.
  If no standalone readiness provider is installed, the caller omits that
  default standalone gate while retaining read-only preflight and the prohibition
  on implementing missing material intent.
  Artificer never runs engineering phases, discovery or specification. Missing
  product intent stops with a blocker; it does not start a question/reply loop.
- **ART-C3 — Worker.** One worker runs one active ticket in one fresh native
  session. Scale by starting more workers. The session owns internal subagents.
  Each delivery has an isolated worktree from freshly fetched main/master,
  never a preceding delivery branch. Configure the host per repository.
- **ART-C4 — Native state.** Initially run locally on macOS, inheriting the
  host's existing profiles, plugins, guidance and login. Store only operational
  correlation in Artificer. Use exact-identity native resume, without copied
  plugins, credentials, conversation archives or archive expiry. Missing native
  state is a blocker, never permission to substitute a fresh owner.
  Operational traces retain protocol identities and status, not prompts,
  conversation messages or tool-result bodies. Blocker/status data and the
  owner's goal identity may be retained for correlation.
  A headless Claude client enters the recipe's explicit native command first.
  After read-only preflight, the original owner may request client-side native
  goal activation with its complete objective. The adapter enters `/goal` once
  in that same session; it never frames the engineering goal or reinvokes the
  recipe. Do not nest a user-only recipe command inside an unprepared goal.
- **ART-C5 — Nomination.** Admit oldest open `artificer:ready` issues nominated
  by a human writer and without unresolved blocking dependencies. Unreadable or
  ambiguous evidence admits nothing. Preserve explicit ticket-scope restrictions.
- **ART-C6 — Shared coordination.** Workers share repository-wide locking,
  host/WIP configuration and durable reservations. Persist reservation before
  effects; consume readiness and apply `artificer:claimed` to the source issue.
  Mark correlated delivery PRs with the same ownership label. Discover open
  labeled Artificer PRs even when no local delivery record remains, and correlate
  them by repository/branch so reservations and their PRs consume one slot.
  Missing labels and uncertain launches do not erase ownership.
- **ART-C7 — Capacity.** Count each active reservation or open Artificer PR
  once; ignore unrelated PRs. WIP defaults to one. Zero pauses admission but
  permits reconciliation. Open PRs hold capacity until closed/merged and
  execution ended. A finished worker may take new work if capacity permits.
  Lowering WIP does not cancel existing work.
- **ART-C8 — Stopped work.** Release only after execution has ended and
  authoritative publication reconciliation finds no open PR. Retain capacity
  while execution/publication is uncertain. Never automatically renominate
  stopped work. Preserve worktrees, branches and published effects.
- **ART-C9 — Recovery.** Resume the original session for recoverable technical
  interruptions, with two attempts per interruption. Immediate recurrence is
  the same interruption; restarting alone does not reset the counter. Observed
  successful native progress establishes recovery. Explicit recovery consumes
  the remaining incident budget and refuses an exhausted incident. Missing intent/state,
  exhausted retries, malformed results and ambiguous effects require attention.
- **ART-C10 — Operations.** Provide explicit skill/CLI setup, status, scheduling,
  pause, revocation, cancellation and native recovery. Show ticket, worker,
  native session, recovery attempts, PR, blocker and next action. Report stopped
  work on its source issue too, including any PR. An ambiguous comment must
  remain locally visible rather than automatically being posted again.
- **ART-C11 — Local scheduling.** Retain launchd with absolute executables and
  a default 900-second tick, independent of Desktop/terminal. Revocation prevents
  later admission and continuation. Cancellation targets only its identified
  process group and does not undo effects.
- **ART-C12 — Legacy state.** Refuse legacy archive-based state with an explicit
  reconciliation instruction. Never silently convert, relaunch or release it.

## Acceptance evidence

Exercise the documented CLI with real filesystem, Git and process state,
substituting only external host/GitHub services. Cover concurrent workers,
claims and WIP/PR lifetimes; latest-main worktrees; profile/session preservation;
core versus optional plugins; readiness blockers; recovery reset/exhaustion;
uncertain effects; reporting; cancellation and revocation. Native protocol
fixtures do not prove live account compatibility: report live limits separately.

Cloud execution, epic recipes and dispatch by subissues/labels are deferred.
Initial dispatch always selects `ticket-to-pr`.
