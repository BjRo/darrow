# Native scheduling: Artificer removal and migration boundaries

Research for [Identify Artificer removal and migration boundaries in Darrow and Sevro](https://github.com/BjRo/darrow/issues/313), under
[Replace Artificer machinery with native host scheduling](https://github.com/BjRo/darrow/issues/311), recorded 2026-11-19.

Replacing Artificer can remove its admission and supervision backend without
replacing Darrow's engineering workflow. The difficult boundary is preserving
explicit authority, work identity and observable publication evidence when the
Python records and adapters disappear. Native scheduling alone does not establish
those promises. This note identifies migration inputs; it chooses no admission,
interruption or setup policy.

## Scope and evidence

The settled research premise is local, best-effort execution while the chosen
machine/app/session runs, using subscription-authenticated Codex scheduled tasks
or Claude native scheduling. Only explicitly nominated GitHub issues qualify.
Implementation, TDD, verification, independent review and PR behavior remain.
No replacement daemon, custom scheduler or Actions factory is in scope. These
are caller constraints, not findings about host scheduling support.

Repository evidence is pinned to Darrow
`de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89`, Sevro
`38022560c2e38f3fed3a5028416425405d59f25b`, and the course
`4339a3095c5d85e4fb2b3b60ff6c1e6d18147180`. Sevro's inspected branch is
`refactor/dependency-cruiser-module-layering`; its branch name is not a migration
base recommendation. Six exact open issues were read on this date. No local
installation, private grant contents, native history, credentials or live schedule
was inspected. Consequently, the number and condition of installed deliveries
remain unknown.

## Observable contracts and replaceable mechanisms

Darrow separates automation timing/admission from task recipes and native
engineering ownership. A _native owner_ is the main thread retaining the goal and
completion responsibility. Layer composition requires explicit recurring
authority, duplicate-work handling, capacity, human handoff and reconciliation.
Those requirements describe observable behavior; they do not require Artificer's
storage layout or programming language. [Design][design], [composition][composition]
and the [glossary][glossary] own these meanings.

The current [ART-C1–C15 specification][art] combines both kinds of requirement.
ART-C1/C2 preserve the recipe's effects and assurance; C5–C10 define nomination,
claims, capacity, stopped work and recovery; C3/C4/C11–C15 include concrete host,
process, launchd, path, profile and discovery choices. Accepted best-effort
operation changes the availability promise in C11, which currently says Desktop
and terminal need not remain open. It does not by itself waive duplicate work,
readiness, authorization or publication requirements. Which operational promises
remain mandatory belongs to later decisions.

The plugin manifests report **0.5.2**, while the backend package separately reports
**0.1.0**. Its authored production package contains **25 Python modules, 2,696
physical lines**, including comments and blanks; this is a size inventory, not a
complexity or deletion estimate. [Manifests][manifests], [package][package].

| Surface     | Current evidence                                                         | Migration candidate, not a decision                                                                      |
| ----------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Plugin/CLI  | `manage-artificer`, `cli.py`, frozen UV launcher                         | Retire worker management; adapt explicit setup/status UX if needed.                                      |
| Timing      | `scheduler.py`: launchd interval, default 900 seconds                    | Remove scheduler implementation when native scheduling is authoritative.                                 |
| Admission   | `admission.py`, `policy.py`, GitHub nomination checks                    | Replace mechanism only after nomination, duplicate and capacity decisions.                               |
| Supervision | `processes.py`, `worker.py`, Codex/Claude adapters, RPC/session protocol | Remove custom spawning, observation and transport recovery; establish native equivalents where required. |
| Delivery    | Ticket-to-PR → Adaptive Goal → selected capabilities                     | Retain engineering behavior and exact-commit assurance.                                                  |

Sources: [management skill][manage], [scheduler][scheduler], [admission][admission],
[processes][processes], [worker][worker], [recipe][recipe].

## The unattended entry must change deliberately

Ticket-to-PR currently permits an unattended adapter only with a receipt naming
grant/grantor, repository, exact issue, delivery/activation IDs, reserved branch and
worktree, and permitted effects. Artificer creates that worktree first; the recipe
copies the receipt unchanged into one Adaptive Goal handoff. Technical recovery
resumes the original session without invoking the recipe again. Missing product
intent stops for preparation outside Artificer. [Unattended entry][unattended],
[prompt construction][prompts].

A native scheduled prompt therefore cannot truthfully claim an Artificer receipt
or a reservation that does not exist. Later design must establish its authorized
entry and branch/worktree preparation boundary. Preserve the ordinary outcome:
TDD, selected verification and independent review, intended commits, non-force
push, one PR, and required CI passing on the final published commit. An existing
PR URL alone does not prove the intended candidate was published. Merge, deploy,
release and unrelated tracker mutations remain outside that envelope.
[Ticket-to-PR contract][recipe], [LC-C4][composition].

## State and operational migration inventory

Current state is repository-keyed outside checkouts, shared across clones and
linked worktrees. An explicit outside-repository state location is remembered by
`location.json`. The installation models bind authority and local correlation;
they do not encode engineering phases. [Launcher][launcher], [models][models],
[installation][installation], [storage][storage].

| Resource                              | Shape and significance                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `~/.darrow/artificer/<owner>/<repo>/` | `grant.json`, `repository.json`, optional location binding, worker binding, admission lock and delivery directories.                                                                                            |
| Grant                                 | Repository/checkout/common Git directory, writer grantor, host/profile/executables, issue scope, effect envelope, enabled flag, pool/WIP/interval. Empty issue scope allows all otherwise eligible nominations. |
| Claim                                 | Issue/delivery/activation/grant IDs; branch/worktree/base; native thread/model/effort; goal objective; process PID/start identity; status/recovery eligibility; PR and report/reconciliation evidence.          |
| Logs                                  | Scheduler stdout/stderr, worker log, native stderr and adapter event traces; these are distinct from native host session storage.                                                                               |
| Entrypoint/shell                      | `~/.local/bin/darrow-artificer`; optional guarded PATH entries in zsh/Bash files.                                                                                                                               |
| launchd                               | `~/Library/LaunchAgents/com.darrow.artificer.<grant-id>.plist`, with checkout, interval, absolute wrapper and log destinations.                                                                                 |
| Git/GitHub                            | `.worktrees/feat/<issue>-artificer-<id>` branches/worktrees; `artificer:ready`/`artificer:claimed`, reservation comments, stopped reports and correlated PRs.                                                   |

Sources: [models][models], [setup][setup], [scheduler][scheduler],
[admission][admission], [adapters][codex], [reporting][reporting]. Paths identify
code-defined resource types, not observed account-local installations.

Removal must account for active and stopped work before disabling its old
observation paths. Revocation prevents future admission/continuation but does not
stop existing execution. Cancellation targets an identified process group and
cannot undo published effects. A missing leader PID may leave descendants alive;
a timeout or removed label does not prove termination. [Management][manage],
[process identity][processes].

A released unfinished delivery can remain explicitly resumable. Recovery requires
the exact native session and original worktree, current authority, available
capacity, reconciled publication and uncontested issue ownership. Completed,
cancelled or unknown-eligibility work is refused. Removing claim files would lose
these distinctions. [Recovery operations][operations].

PR reconciliation binds repository, branch and base; it searches by branch when
no PR number is saved. Labeled open PRs without local records still occupy
capacity, and correlated reservations/PRs count once. A failed blocker-comment
response is persisted as uncertain, preventing automatic duplicate reporting.
Later migration must preserve enough evidence to reconcile ambiguous effects,
including orphaned labels and PRs, before any renomination or new owner.
[Reconciliation][reconciliation], [admission][admission], [reporting][reporting].

Legacy `.git/artificer` is another distinct case: current commands refuse it,
including through the common Git directory, and require human reconciliation.
That existing refusal is not evidence that deleting legacy state is safe.
[Launcher][launcher], [ART-C12][art].

Native session pointers are especially important during transition. Artificer
stores thread, model and effort, while the host retains conversation history.
Codex uses app-server thread start/resume plus native goal observations; Claude
uses its stream/resume protocol and a prepared same-session `/goal` handoff.
Removing these adapters removes protocol-specific validation and the two-attempt
transport recovery counter. It does not demonstrate that a scheduled task can
restore an existing owner or distinguish a completed goal from a completed turn.
Those are evidence requirements for later interruption choices. Tests named for
released recovery, concurrent admission, reconciliation and Claude lifecycle
cover different concerns; deleting the backend should not silently delete the
observable guarantees they currently exercise. [Native state contract][art],
[Codex adapter][codex], [recovery implementation][worker].

## Repository setup and compatibility boundaries

Artificer currently needs macOS, UV/Python 3.10–3.13, Git, writer-authorized `gh`,
a configured host/profile and installed recipe/core assurance plugins. Its wrapper
resolves Artificer from the host's default profile dynamically; delivery can use
an explicitly selected profile. Native scheduling may remove Artificer's Python,
launcher and launchd prerequisites, but other capabilities can still require UV
and Python. [Plugin prerequisites][readme], [launcher][launcher].

| Repository         | Prerequisites and retained obligations                                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Darrow             | Bun development tools; contained Python packages and inventory; Sevro 1.1.2 dev dependency; plugin discovery and applicable host login/guidance. Removing one backend does not remove these repository-wide needs.                                                |
| Sevro              | Installed Node ≥24.13.0; contributor Bun 1.3.13, Git/npm/rg; platform isolation tools for full suite; native trials require their own setup. Preserve fast pre-commit checks and exact-head GitHub CI monitoring/repair for implementation PRs.                   |
| Other repositories | Explicit repository and issue scope, usable checkout/origin, host-visible recipe/capabilities, applicable checks, authentication and publication access must be established per project. Current Artificer only accepts unambiguous main/master default branches. |

Sources: [Darrow package][darrow-package], [Sevro package][sevro-package],
[Sevro contribution contract][sevro-contrib], [worker][worker]. The general setup
row derives requirements from existing contracts; it is not a proposed installer.

Sevro contains no Artificer runtime integration in the inspected tracked-source
search. Its Artificer references occur in isolation tests that write synthetic
`.git/artificer` lock/grant files while testing permitted workspace Git metadata.
Those fixtures do not represent an installed Artificer dependency. Their security
purpose may survive retirement; renaming/removal needs a reason beyond the string
match. [Isolation tests][sevro-isolation].

## Packaging, cleanup and outstanding scope

The course separates Actions YAML, a short TypeScript launcher and adjacent
Markdown prompt. Its implement script selects Sandcastle/Claude and the workflow
owns publication; the prompt owns repository work and commits. That separation is
useful packaging evidence. Its OAuth/PAT provisioning, Actions execution,
permission bypass and per-run branches/PRs are different runtime and authority
choices, excluded here. Its own workflow explicitly allows two retries/runs to
produce two PRs. [Course workflow][course-workflow], [launcher][course-script],
[prompt][course-prompt], [shared host configuration][course-common].

Retirement touches more than the plugin directory: marketplace entry, both
manifests, Python inventory, Artificer CI jobs, management evals, deterministic
backend tests, guide fixtures/oracles, recipe unattended eval and docs across the
layer/spec/selection/install surface. Keep historical research as dated evidence;
revise active guidance and links. Existing docs already differ: the automation
landing page says Codex CLI while the current spec supports both hosts. Preserve
behavioral tests that remain applicable and replace transport-specific coverage
with actual native-entry evidence; fixtures alone cannot prove account or host
compatibility. Claude's current adapter explicitly lacks independently observed
native goal completion. [Marketplace][marketplace], [Python CI][python-ci],
[guide fixtures][guide-fixture], [unattended eval][unattended-eval],
[automation landing page][automation], [acceptance limits][art].

| Open ticket, read 2026-11-19                                                                                             | Why scope needs revisiting                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [Add Artificer automation for capacity-aware ticket delivery](https://github.com/BjRo/darrow/issues/126)                 | Parent still requires Actions, encrypted archives/retention, issue replies and independent activation limits; current ART differs.       |
| [Add GitHub Actions execution for Artificer](https://github.com/BjRo/darrow/issues/158)                                  | Actions execution conflicts with the settled replacement direction; unresolved authentication is not solved by native migration.         |
| [Attribute Artificer delivery telemetry through native environment variables](https://github.com/BjRo/darrow/issues/285) | Native telemetry attribution is useful intent, but Artificer's process-environment injection point disappears.                           |
| [Add Windows and Linux support to Artificer](https://github.com/BjRo/darrow/issues/308)                                  | Platform support shifts from Artificer portability to chosen native-host/setup support.                                                  |
| [Polish the Artificer user experience](https://github.com/BjRo/darrow/issues/309)                                        | UX target changes when CLI management is retired/adapted.                                                                                |
| [Support independently scheduled Artificer specialist missions](https://github.com/BjRo/darrow/issues/310)               | Specialist issue-only missions and separate schedules need a new entry; nomination and duplicate-publication boundaries remain relevant. |

These are scope-review candidates, not closure recommendations. Later decisions
still own admission/capacity, interrupted-owner handling and setup/migration.
This investigation ran no native schedules or deliveries and changed no runtime,
labels, claims, credentials or issues. It establishes repository boundaries,
not operational migration completion.

[design]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/docs/design.md
[composition]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/docs/specs/layer-composition.md
[glossary]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/docs/glossary.md
[art]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/docs/specs/artificer.md
[manifests]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/.claude-plugin/plugin.json
[package]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/pyproject.toml
[manage]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/skills/manage-artificer/SKILL.md
[recipe]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/docs/specs/ticket-to-pr.md
[unattended]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/references/unattended.md
[readme]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/README.md
[darrow-package]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/package.json
[marketplace]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/.claude-plugin/marketplace.json
[python-ci]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/.github/workflows/python-quality.yml
[guide-fixture]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/.agents/skills/darrow-guide/evals/fixtures/setup.sh
[unattended-eval]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/unattended-grant.yaml
[automation]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/README.md
[scheduler]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/scheduler.py
[admission]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/admission.py
[processes]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/processes.py
[worker]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/worker.py
[prompts]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/prompts.py
[launcher]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/launcher.py
[models]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/models.py
[installation]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/installation.py
[storage]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/storage.py
[setup]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/setup.py
[codex]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/codex.py
[reporting]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/reporting.py
[operations]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/operations.py
[reconciliation]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/automation/darrow-artificer/backend/src/darrow_artificer/reconciliation.py
[sevro-package]: https://github.com/BjRo/sevro/blob/38022560c2e38f3fed3a5028416425405d59f25b/package.json
[sevro-contrib]: https://github.com/BjRo/sevro/blob/38022560c2e38f3fed3a5028416425405d59f25b/CONTRIBUTING.md
[sevro-isolation]: https://github.com/BjRo/sevro/blob/38022560c2e38f3fed3a5028416425405d59f25b/tests/src/hosts/isolation.test.ts
[course-workflow]: https://github.com/BjRo/ai-coding-software-factory-course/blob/4339a3095c5d85e4fb2b3b60ff6c1e6d18147180/.github/workflows/agent-implement.yml
[course-script]: https://github.com/BjRo/ai-coding-software-factory-course/blob/4339a3095c5d85e4fb2b3b60ff6c1e6d18147180/.sandcastle/agent-workflows/implement/implement.ts
[course-prompt]: https://github.com/BjRo/ai-coding-software-factory-course/blob/4339a3095c5d85e4fb2b3b60ff6c1e6d18147180/.sandcastle/agent-workflows/implement/prompt.md
[course-common]: https://github.com/BjRo/ai-coding-software-factory-course/blob/4339a3095c5d85e4fb2b3b60ff6c1e6d18147180/.sandcastle/agent-workflows/shared/common.ts
