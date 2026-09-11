# Darrow glossary

These terms have project-specific meanings. Follow their source for the full
contract.

| Term          | Meaning and normative source                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin        | An independently installable unit of adoption and ownership; see [optionality boundaries](decisions/ADR-0003-treat-plugins-as-optionality-boundaries.md).            |
| Skill         | A focused procedure advertised to the host through trigger metadata; see [skill authoring](specs/skill-authoring.md).                                                |
| Capability    | Intent-matched work with its own outcome and invariants; see [capabilities and orchestration](decisions/ADR-0002-separate-capabilities-from-orchestration.md).       |
| Foundation    | A capability that maintains durable context or reusable agent surfaces; see [layer composition](specs/layer-composition.md).                                         |
| Orchestration | An explicitly invoked owner of the completion contract and execution handoff; see [Adaptive Delivery](specs/adaptive-delivery.md).                                   |
| Task recipe   | An explicit familiar outcome and permission envelope that delegates bounded work; see [ticket to PR](specs/ticket-to-pr.md).                                         |
| Native owner  | The host-visible agent that owns execution after the handoff; see [native goal ownership](decisions/ADR-0004-use-native-goal-ownership-for-core-orchestration.md).   |
| Readiness     | An assessment of whether work has sufficient decisions and evidence to implement; see [implementation readiness](specs/implementation-readiness.md).                 |
| ADR           | An architecture decision record with an explicit status and lifecycle; see [decision management](specs/decision-management.md).                                      |
| Eval          | A case measuring behavior in a real host, distinct from a deterministic script test; see [skill evaluation](specs/skill-evaluation.md).                              |
| Activation    | Evidence that a skill was selected, separate from evidence that the task succeeded; see [skill evaluation](specs/skill-evaluation.md).                               |
| Ablation      | A matched comparison that changes skill presence while holding other conditions fixed; see [skill evaluation](specs/skill-evaluation.md).                            |
| Read-only     | The guide may inspect source files and explain them but cannot execute diagnostics, mutate state, or launch work; see [repository guide](specs/repository-guide.md). |

## Evidence states

The [repository guide contract](specs/repository-guide.md#evidence-policy) defines
these states:

- **Authoritative:** an applicable current source directly establishes a claim.
- **Derived:** inspected code or tests support an explicitly labelled inference.
- **Conflicting:** sources disagree; both must be cited and the ambiguity exposed.
- **Unknown:** available sources do not establish the answer.

A source's existence does not prove that a test passed or a plugin is installed.
Research and historical material remain context, even when they sound decisive.

Return to the [documentation hub](README.md).
