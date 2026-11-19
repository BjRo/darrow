# Native scheduling entry for Darrow delivery

Native local scheduling is feasible on both hosts. Neither host currently
provides a demonstrated, drop-in replacement for Artificer's authorized
Ticket-to-PR entry. Codex documents explicit scheduled skill invocation. Claude
documents a restriction that prevents `/loop` from automatically invoking the
existing explicit-only recipe. Persistent Claude Desktop scheduling is a
different surface whose recipe and native-goal composition still needs testing.

The smallest candidate replaces admission and launch around the existing
delivery owner. It must preserve recurring human authority and deliberately
adapt the unattended entry contract; changing the scheduler alone is
insufficient. This investigation resolves feasibility for
[Establish native scheduling and delivery entry on Codex and Claude Code](https://github.com/BjRo/darrow/issues/312), under
[Replace Artificer machinery with native host scheduling](https://github.com/BjRo/darrow/issues/311). It does not choose the
remaining user policy or implement the replacement.

## Evidence and limits

Reviewed on 2026-11-19. Official documentation establishes advertised behavior,
not observed scheduling success. Darrow source was inspected at
`de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89`.

Read-only local checks found Codex CLI `0.170.0`, Claude Code `2.1.328`, and
ChatGPT desktop `26.1103.60933`. Both CLI plugin listings returned enabled
Ticket-to-PR, Adaptive Goal, Verification and Review plugins; Claude reported
user scope. These listings do not prove Desktop discovery, scheduled-session
availability, account entitlement, loaded versions, native goal controls, or
successful delivery. No account/profile contents were inspected. No task,
delivery session, credential change, or live recurring delivery was created.

## Host feasibility and compatibility

“Documented” below means primary host documentation; “gap” means no live proof
was gathered. Worktree isolation protects files, not issue ownership.

| Concern                  | Codex project schedule                                                                                                                                                                                                                                                                                                                            | Claude native schedule                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry and context        | Standalone runs start fresh chats; schedules inside a chat retain its context. Explicit `$skill-name` and plugins are documented. [Scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app)                                                                                                                                       | Desktop creates fresh sessions. `/loop` runs in its existing session. [Desktop scheduling](https://code.claude.com/docs/en/desktop-scheduled-tasks), [session scheduling](https://code.claude.com/docs/en/scheduled-tasks)                                                                                                                            |
| Isolation                | Local directory or background worktree. Managed worktrees normally start detached; a branch must subsequently be established. [Scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app), [worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)                                                                   | Desktop defaults to current working-directory state; Worktree is opt-in. `/loop` inherits its session checkout. [Desktop scheduling](https://code.claude.com/docs/en/desktop-scheduled-tasks), [session scheduling](https://code.claude.com/docs/en/scheduled-tasks)                                                                                  |
| Availability             | Local project requires machine, app and directory available. Catch-up and overlap guarantees remain gaps. [Scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app)                                                                                                                                                               | Desktop requires awake computer/app; one catch-up run covers missed runs within seven days. History identifies skips for active previous runs or other scheduled work. [Desktop scheduling](https://code.claude.com/docs/en/desktop-scheduled-tasks)                                                                                                  |
| Permissions              | Default sandbox; ordinarily `approval_policy = "never"`, subject to managed requirements. Necessary GitHub/network and filesystem operations must actually be allowed. [Scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app)                                                                                                  | Desktop has per-task permission mode and saved approvals; blocked prompts can be answered in its run session. `/loop` inherits session permissions. [Desktop scheduling](https://code.claude.com/docs/en/desktop-scheduled-tasks), [session scheduling](https://code.claude.com/docs/en/scheduled-tasks)                                              |
| Lifecycle and management | Create/update from chat; Scheduled shows tasks and runs. No expiry or automatic failed-delivery recovery promise established here. [Scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app)                                                                                                                                      | Desktop persists across restarts; create/edit/pause/run-now/history/delete are native. `/loop` has seven-day expiry; `CronCreate`, `CronList`, `CronDelete` manage session tasks. [Desktop scheduling](https://code.claude.com/docs/en/desktop-scheduled-tasks), [session scheduling](https://code.claude.com/docs/en/scheduled-tasks)                |
| Explicit-only recipe     | Codex's `allow_implicit_invocation: false` still allows explicit invocation. A schedule's `$ticket-to-pr` is syntactically supported, but receipt compatibility remains unresolved. [Skills](https://developers.openai.com/codex/skills), [recipe metadata](../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/agents/openai.yaml) | `/loop` delivers `disable-model-invocation: true` skills as plain text, not executed skills. Desktop's treatment of that flag is undocumented in the reviewed scheduling page. [Session scheduling](https://code.claude.com/docs/en/scheduled-tasks), [skill invocation controls](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill) |

Claude `/loop` is suitable for temporary polling, not equivalent to persistent
Desktop scheduling. Fixed `CronCreate` tasks can restore on resume if unexpired;
self-paced loops do not. Busy sessions coalesce missed fires. Project
`.claude/loop.md` supplies the default for bare `/loop`; an explicit prompt
overrides it. It is neither a delivery grant nor an admission queue.
[Session scheduling](https://code.claude.com/docs/en/scheduled-tasks)

Desktop skills include personal, project and installed-plugin sources. This
supports using the existing installation rather than copying plugins or
credentials, but each actual scheduled run must discover its compatible
capabilities. [Claude Desktop skills](https://code.claude.com/docs/en/desktop#use-skills)
Codex similarly discovers repository/user skills, and its explicit invocation
policy does not confer permission for external effects.
[Codex skills](https://developers.openai.com/codex/skills)

### Subscription execution

Codex distinguishes ChatGPT included usage from separately billed API-key
sessions; credits and pay-as-you-go can extend usage. Native scheduling does
not imply free or unlimited work. Keep the intended subscription-authenticated
host, observe usage, and stop on unavailable allowance rather than choosing
another billing route. [Codex pricing](https://developers.openai.com/codex/pricing)

Claude Desktop Code requires a supported subscription. Claude Code accepts
claude.ai subscription sign-in as well as other authentication routes; expired
sign-in may need a person. Subscription users have included usage, and optional
usage credits can extend it. A session's displayed API-equivalent cost is not
itself subscriber billing evidence. No account-specific entitlement or absence
of additional charges was verified here.
[Desktop requirements](https://code.claude.com/docs/en/desktop-quickstart),
[authentication](https://code.claude.com/docs/en/authentication),
[usage and costs](https://code.claude.com/docs/en/costs)

## What the existing delivery entry requires

[Ticket-to-PR](../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/SKILL.md)
is an explicit recipe: one ticket, one Adaptive Goal request, TDD, verification,
intended commits, non-force push, one verified PR, and green required CI on the
final commit. It forbids merge, deployment, unrelated changes and ungranted
tracker effects. Its Claude frontmatter sets `disable-model-invocation: true`.
Installation or ordinary implementation intent cannot activate it.

Its [unattended contract](../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/references/unattended.md)
currently names Local Artificer and requires grant/grantor, repository, exact
issue, delivery/activation IDs, effects, reserved worktree and branch. It states
that Artificer already created that worktree and checked out that branch.
Missing authority or fields stops delegation. Ticket text/comments cannot
supply authority. Therefore a native managed worktree plus a fabricated
Artificer receipt is not a valid substitute.

[Adaptive Goal](../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/SKILL.md)
retains the original main-thread owner. It accepts explicit orchestration or
preserved delegation from an authorized entry, establishes read-only preflight
and required readiness, binds compatible assurance, and activates the native
goal before engineering. A fresh schedule run is not automatically continuation
of a prior delivery. Refusals remain binding; missing intent cannot be invented.

The [composition contract](../specs/layer-composition.md#automation-contracts-required-before-shipping)
requires recurring authority/provenance, admission and duplicate handling,
capacity, human handoff and reconciliation. Native timers do not discharge
these obligations. A host skipping its own overlapping run does not establish
atomic exclusion across another task, clone, host, manual owner or open PR.
Replacing only Artificer leaves these observable delivery and authority
requirements intact. [Design boundaries](../design.md)

### Python machinery versus required promises

| Current mechanism                                                                                              | What must survive replacement                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Python `Grant`/`Claim` records, UUID receipt fields and Artificer-named provenance                             | Verifiable human authorization, exact repository/issue/effects, run correlation, revocation and unambiguous ownership. Field names/storage are implementation choices; today's recipe still requires them until deliberately revised. [Entry contract](../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/references/unattended.md)                                                                                                                                         |
| Reserved `feat/<issue>-artificer-<id>` branch and pre-created linked worktree from freshly fetched main/master | Preserve user work, intended base and one exact delivery target. Host-created detached worktrees cannot honestly be described as pre-reserved checked-out branches. Latest-base behavior also needs explicit reconciliation. [Admission](../../plugins/automation/darrow-artificer/backend/src/darrow_artificer/admission.py), [worker](../../plugins/automation/darrow-artificer/backend/src/darrow_artificer/worker.py)                                                                  |
| `launchd`, worker processes, profile-bound app-server/print transports and structured outcome JSON             | Host-native scheduling and execution can replace these mechanics. Keep installed capabilities, original session identity, goal activation/completion evidence and disclosed partial effects. The JSON transport is not recipe acceptance. [Native adapters](../../plugins/automation/darrow-artificer/backend/src/darrow_artificer/native.py), [entry prompt](../../plugins/automation/darrow-artificer/backend/src/darrow_artificer/prompts.py)                                           |
| Ready/claimed labels, repository lock and PR-correlated capacity                                               | Only explicitly nominated issues; authoritative admission and duplicate reconciliation. Existing source checks human-writer nomination and blocking dependencies. Labels, ordering and capacity settings are later policy choices, not consequences of picking a host scheduler. [GitHub observations](../../plugins/automation/darrow-artificer/backend/src/darrow_artificer/github.py), [admission](../../plugins/automation/darrow-artificer/backend/src/darrow_artificer/admission.py) |

The current Claude adapter deliberately refuses `pr-open` completion because
its supported stream lacks independently observed native-goal completion. Codex
checks the original thread's goal and final outcome. Moving into Desktop may
remove that particular transport limitation, but does not prove completion or
authorize weakening the evidence requirement.
[Claude adapter](../../plugins/automation/darrow-artificer/backend/src/darrow_artificer/claude.py),
[Codex session](../../plugins/automation/darrow-artificer/backend/src/darrow_artificer/session.py)

## Minimum candidate entry per host

**Codex:** one project-scoped standalone local task, using an isolated host
worktree and the existing subscription host. Its durable prompt identifies the
human recurring grant and nominated issue scope, performs admission, and enters
the deliberately revised unattended recipe once for one exact issue. The
documented `$ticket-to-pr` syntax is the smallest invocation candidate. The
entry must distinguish the host's actual checkout/branch state from Artificer's
old reserved-target assertions. Existing Adaptive Goal and delivery capabilities
then own all engineering. This is a candidate contract, not permission to run
the current recipe with missing receipts.

**Claude:** use a persistent local Desktop task as the durable timing candidate;
retain `/loop` only where temporary same-session operation is intended. A
supported, explicitly authorized unattended entry must first be established.
Test whether Desktop supports the explicit-only recipe under saved recurring
authority. If it refuses, stop: do not load the file manually, paste the recipe
body, remove its flag, simulate a user slash command, or nest it inside `/goal`
to get around the refusal. A separately designed schedulable automation entry
would need deliberate authority and compatibility with the existing delivery
envelope; it is future design work, not an existing workaround.

Neither candidate adds a delivery controller, substitutes a new implementation
workflow, or treats a later timer fire as recovery. An interrupted delivery
belongs to its original native owner.
[Continuation contract](../specs/layer-composition.md#shared-handoff-rule)

## Gaps and necessary future experiments

Use disposable repositories and one-shot/manual trials before authorizing
recurring delivery. Keep policy decisions in their later tickets.

1. **Invocation and authority:** test a harmless explicit-only fixture on Codex
   and Claude Desktop, alongside Claude `/loop`'s documented rejection. Record
   whether instructions expand, the source role/provenance, loaded plugins and
   refusal behavior. A successful skill expansion alone proves no grant.
2. **Native owner:** after preflight, prove Codex goal controls and Claude's
   supported goal proposal/activation in the scheduled session. Claude's public
   `/goal` supports Desktop, retains active goals on resume, and can clear or
   pause on errors; its evaluator uses conversation evidence. This does not
   prove model-side activation or Darrow completion observation.
   [Claude goals](https://code.claude.com/docs/en/goal)
3. **Overlap and ambiguity:** hold one run open; trigger another schedule and a
   second host/clone against the same nominated issue. Establish conflict and
   capacity behavior, uncertain claim/publication handling, and no duplicate
   delivery. Do not infer safety from worktree separation.
4. **Interruption and continuation:** exercise sleep, app restart, permission
   wait, usage exhaustion and cancellation. Find the original run; answer there;
   verify session/goal/candidate identity. Distinguish a missed-run catch-up from
   resuming unfinished work. Check whether pausing/deleting a schedule affects
   already-running sessions; documentation does not establish that boundary.
5. **Actual delivery:** only after entry decisions and harmless trials, exercise
   one nominated fixture issue through unchanged TDD, verification, independent
   review, non-force PR publication and final green CI. Record native completion,
   usage, exact commit and effects. One success is composition evidence, not a
   cross-host reliability guarantee.

The unresolved decisions are how nomination, grants, admission, capacity,
revocation and blocked-work handoff should be represented. This research does
not settle them. No custom scheduler/daemon, API-key execution or GitHub Actions
is necessary to investigate the native candidates.
