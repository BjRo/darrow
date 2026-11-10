# Local Artificer

Artificer is an explicitly authorized unattended worker around a normal,
plugin-equipped Claude Code or Codex session. It owns admission and execution
supervision. Task recipes and their native session own engineering.

- **ART-C1 — Entry and authority.** Installing the plugin starts nothing. First `init` authorizes unattended delivery and binds
  a repository, writer grantor, recurring authority, effect envelope and revocation.
  Initially invoke only `ticket-to-pr` for ready GitHub issues. Preserve recipe
  verification, commit, non-force push and PR requirements. No merge, deploy,
  release, billing changes or unrelated mutations.
- **ART-C2 — Composition.** Require Adaptive Goal, verification and review in
  the session before engineering. Other plugins (TDD, Git, tickets, etc.) are
  optional; use applicable installed capabilities and retain their refusals.
  Supported owners execute public assessment coordination inline; weaker or
  unknown routes use one capable bounded coordinator with fresh independent
  readers. Neither placement changes admission, claims, native identity,
  continuation or gates.
  Optional isolated ticket workers remain bounded assignments inside that
  delivery's existing finite scope and grant. They do not select another recipe,
  admit unrelated tickets or create multi-issue atomic reservations. A one-issue
  Ticket-to-PR admission and its worktree authority do not authorize additional
  ticket deliveries. Missing scope or worker-effect authority stops affected
  work without changing admission or reservation state.
  If no standalone readiness provider is installed, the caller omits that
  default standalone gate while retaining read-only preflight and the prohibition
  on implementing missing material intent.
  Artificer never runs engineering phases, discovery or specification. Missing
  product intent stops with a blocker; it does not start a question/reply loop.
- **ART-C3 — Worker.** One worker runs one active ticket in one fresh native
  session. A configured worker pool starts up to its free slots in one tick, capped by WIP. The session owns internal subagents.
  Each delivery has an isolated worktree from freshly fetched main/master,
  never a preceding delivery branch. Configure the host per repository.
- **ART-C4 — Native state.** Initially run locally on macOS, inheriting the
  host's default profile (`~/.codex` or `~/.claude`), plugins, guidance and login,
  ignoring ambient profile overrides. An explicit profile
  directory chosen at initialization selects that host profile (`CODEX_HOME` or
  `CLAUDE_CONFIG_DIR`) for every launch and resume. Store only operational
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
  Successful delivery requires independently observed native goal completion.
  Claude cannot bypass the prepared `/goal` handoff with a structured `pr-open`
  result. Where its supported protocol cannot establish goal completion, retain
  the published PR and report that evidence gap as needing attention; do not
  present a model's completion report as equivalent to Codex goal evidence.
  Preserve the established delivery blocker through transient reconciliation
  failures and recovery. Operational errors must not erase the native completion
  evidence gap from status or the eventual source-issue report.
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
  Capacity release is not loss of recoverability. An unfinished released delivery
  may explicitly resume its original session after reacquiring shared capacity
  and source-issue ownership under the repository lock. Recheck current writer
  authority, grant/scope, worker availability, native state and published effects;
  refuse conflicting issue ownership, uncertain effects or unavailable capacity.
  Never automatically resume released work or replace its session/worktree.
  Completed and cancelled work is terminal. Unknown historical eligibility requires
  human reconciliation. Explicit cancellation of resumable released work marks it
  terminal without reacquiring capacity or changing published effects.
- **ART-C9 — Recovery.** Resume the original session for recoverable technical
  interruptions, with two attempts per interruption. Immediate recurrence is
  the same interruption; restarting alone does not reset the counter. Only a
  successfully completed native turn establishes execution recovery and resets
  the incident budget. Successful tool calls, incidental reads and diagnostics
  do not reset it. This bounds transport/execution interruptions, not retries of
  engineering operations inside a healthy native turn. Explicit recovery consumes
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
- **ART-C12 — Legacy state.** Every command refuses an existing `.git/artificer`
  directory, including through linked worktrees, with instructions to remove it
  and run `darrow-artificer init`. Never migrate, relaunch or release legacy state.
- **ART-C13 — Installation and discovery.** Keep config, claims, locks and worker
  records in `~/.darrow/artificer/<owner>/<repo>/`, shared across independent clones
  and linked worktrees. Explicit `--state` selects an outside-repository location.
  Only delivery worktrees live in the checkout where initialization ran. Commands
  discover the installation from the checkout's GitHub origin; absent state
  refuses without writes and explains `darrow-artificer init`.
- **ART-C14 — Setup and entrypoint.** Interactive `init` detects the checkout and
  repository, suggests settings, prompts for missing inputs including host, shows
  repository, host, profile, workers, WIP and state, and confirms before saving.
  Scripted initialization requires explicit repository, checkout and host flags;
  list missing flags without waiting. A saved host is reusable. Install
  `~/.local/bin/darrow-artificer`. On macOS, guided setup previews shell-file
  destinations and offers PATH integration separately from the final save
  confirmation. Scripted setup edits shell files only with `--setup-path`.
  Support zsh's `$ZDOTDIR/.zshrc` (HOME when unset); a set ZDOTDIR must name a
  nonempty absolute directory. Support Bash's `.bashrc` plus
  the first existing `.bash_profile`, `.bash_login`, or `.profile` (create
  `.bash_profile` if none exists). Refuse explicit setup for unsupported shells
  or platforms. When the command directory is already on PATH, leave shell
  files alone. Otherwise use a guarded, managed entry that is idempotent both
  on disk and at shell startup. Preserve surrounding bytes, file permissions,
  and dotfile symlinks; refuse unreadable, broken, or malformed managed files
  before persistent setup effects. Explain opening a new terminal or sourcing
  the file; initialization cannot change the invoking shell's environment.
  Warn about a missing PATH entry when integration is declined or not requested.
  Repeating `init` repairs the wrapper and optional PATH integration using the
  saved installation context. It must not change or reauthorize the grant,
  recreate labels, or change the saved host, profile, checkout, or issue scope.
  Omitted settings reuse saved values; conflicting explicit settings or state
  refuse. Overall confirmation refusal performs no writes.
  The wrapper resolves the currently installed Artificer from the selected host's
  default profile on every invocation; absence refuses clearly. Project-scoped
  Artificer installations cannot satisfy or override this lookup. One launchd job
  per installation uses that same dynamic resolution on each scheduled run.
- **ART-C15 — Plugins and pool.** `configure --workers N` changes pool capacity;
  status covers the pool and cancellation/recovery select a delivery ID. All
  workers share host and profile. Use installed profile plugins as-is at every
  start/resume, without snapshots. Before any claim, list plugins through
  `claude plugin list --json` (in the checkout) or `codex plugin list --json`, with
  the selected profile environment. Require enabled `darrow-ticket-to-pr` and
  `darrow-adaptive-goal`; missing/disabled plugins and listing errors, including
  unloadable marketplaces, leave issues unclaimed. Status includes the blocker
  and underlying host error.

## Acceptance evidence

Exercise the documented CLI with real filesystem, Git and process state,
substituting only external host/GitHub services. Cover concurrent workers,
claims and WIP/PR lifetimes; latest-main worktrees; profile/session preservation;
core versus optional plugins; readiness blockers; recovery reset/exhaustion;
uncertain effects; reporting; cancellation and revocation. Native protocol
fixtures do not prove live account compatibility: report live limits separately.

Composed engineering evidence MUST exercise real Ticket-to-PR, Adaptive Goal,
Verification and Review workflows, independent reader judgments, same-session
native resume after process exit, and the intended committed, published and
CI-verified candidate. Local forge fixtures may replace external effects, but
transport-only or mocked model execution cannot establish these native workflow
claims. Report route, usage, trial count and limitations.

Cloud execution, epic recipes and dispatch by subissues/labels are deferred.
Initial dispatch always selects `ticket-to-pr`.
