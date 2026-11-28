# Darrow glossary

These terms have project-specific meanings. Follow their source for the full
contract.

| Term          | Meaning and source                                                                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin        | An independently installable unit of adoption and ownership; see [optionality boundaries](decisions/ADR-0003-treat-plugins-as-optionality-boundaries.md).                                           |
| Skill         | A focused procedure advertised to the host through trigger metadata; see [Matt bundle](../plugins/capability/darrow-matt-pocock/README.md).                                                         |
| Capability    | Intent-matched work with its own outcome and invariants; see [capabilities and orchestration](decisions/ADR-0002-separate-capabilities-from-orchestration.md).                                      |
| Foundation    | A capability that maintains durable context or reusable agent guidance; see [layer composition](design.md).                                                                                         |
| Orchestration | An explicitly invoked owner of the completion contract and execution handoff; see [Adaptive Goal](../plugins/orchestration/darrow-adaptive-goal/README.md).                                         |
| Task recipe   | An explicit familiar outcome and permission envelope that delegates bounded work; see [ticket to PR](../plugins/task-recipe/darrow-ticket-to-pr/README.md).                                         |
| Native owner  | The main thread that retains the native goal and completion while delegating bounded assignments; see [native goal ownership](decisions/ADR-0012-keep-native-goal-ownership-in-the-main-thread.md). |
| Readiness     | An assessment of whether work has sufficient decisions and evidence to implement; see [implementation readiness](../plugins/capability/darrow-readiness-gate/README.md).                            |
| ADR           | An architecture decision record with an explicit status and lifecycle; see [ordinary ADR maintenance](decisions/README.md).                                                                         |
| Eval          | A case measuring behavior in a real host, distinct from a deterministic script test; see [skill evaluation](eval-development.md).                                                                   |
| Activation    | Evidence that a skill was selected, separate from evidence that the task succeeded; see [skill evaluation](eval-development.md).                                                                    |
| Ablation      | A matched comparison that changes skill presence while holding other conditions fixed; see [skill evaluation](eval-development.md).                                                                 |
| Read-only     | The guide may inspect source files and explain them but cannot execute diagnostics, mutate state, or launch work; see [repository guide](../.agents/skills/darrow-guide/SKILL.md).                  |

A **curated bundle** is a pinned selection of upstream skills with recorded Darrow
adaptations. Matt Pocock and pstack are independently installable MIT bundles;
their installer pin is distinct from the source-content revision. See
[acquisition](plugin-development.md#curated-upstream-inputs) and [migration](decisions/ADR-0015-curate-upstream-workflows-and-retire-duplicate-providers.md).

A **verdict** is one claim's VERIFIED, NOT VERIFIED or INCONCLUSIVE result.
INCONCLUSIVE is never a pass. Adaptive Goal gives one verdict per acceptance
criterion; see [acceptance](../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/references/verification-lifecycle.md).

## Evidence states

The [repository guide](../.agents/skills/darrow-guide/SKILL.md#inspect-the-evidence) defines
these states:

- **Authoritative:** an applicable current source directly establishes a claim.
- **Derived:** inspected code or tests support an explicitly labelled inference.
- **Conflicting:** sources disagree; both must be cited and the ambiguity exposed.
- **Unknown:** available sources do not establish the answer.

A source's existence does not prove that a test passed or a plugin is installed.
Historical material remains context, even when it sounds decisive.

Return to the [documentation hub](README.md).
