# ADR catalog

This catalog is a manually maintained navigation aid. ADR files remain canonical.
Update each affected row alongside its ADR, preserving status and relationships.
Run `bun run check:docs` for general documentation and link checks.

Partial supersession notes in ADR-0004, ADR-0006 and ADR-0012 retain their
original authority and source commits. ADR-0014 replaces the separate-specification
and tracked-history obligations in ADR-0006, ADR-0007 and ADR-0010. Other clauses
and statuses remain unchanged.

## Proposed

<!-- prettier-ignore -->
| Decision | Status | Date | Summary | Relationships |
| --- | --- | --- | --- | --- |

## Accepted

<!-- prettier-ignore -->
| Decision | Status | Date | Summary | Relationships |
| --- | --- | --- | --- | --- |
| [ADR-0002: Separate capabilities from orchestration](ADR-0002-separate-capabilities-from-orchestration.md) | Accepted | 2026-08-13 | Keep capabilities intent-matched and independently selectable while starting continuation-owning orchestration only through explicit user invocation. | None |
| [ADR-0003: Treat plugins as optionality boundaries](ADR-0003-treat-plugins-as-optionality-boundaries.md) | Accepted | 2026-08-13 | Treat each plugin as a self-contained unit of adoption, compatibility, and ownership that composes through host-visible skill intent rather than sibling dependencies or a separate capability registry. | None |
| [ADR-0006: Keep decisions with their authoritative owners](ADR-0006-keep-decisions-with-their-authoritative-owners.md) | Accepted | 2026-08-13 | Keep each decision at the narrowest durable authoritative owner its consumers obey, with one canonical owner per effect and honest gaps for inaccessible owners. | Partially superseded by: ADR-0014 |
| [ADR-0007: Separate skill evaluation evidence dimensions](ADR-0007-separate-skill-evaluation-evidence-dimensions.md) | Accepted | 2026-08-13 | Represent invariant coverage, task outcomes, matched skill ablation, and skill activation as separate evaluation evidence dimensions. | Partially superseded by: ADR-0014 |
| [ADR-0009: Adopt Python and UV for substantial plugin mechanics](ADR-0009-adopt-python-and-uv-for-substantial-plugin-mechanics.md) | Accepted | 2026-09-17 | Adopt contained Python packages managed by UV incrementally for substantial cross-platform plugin mechanics, invoked through plugin-owned bootstraps resolved from installed skill paths. | Supersedes: ADR-0005; Amended: 2026-11-26 for external runtime storage and bootstrap invocation ([#370](https://github.com/BjRo/darrow/issues/370)); Revisit when: UV and supported Python cannot provide independently installable helpers across every supported native host, or a lighter common runtime offers materially better portability and containment. |
| [ADR-0010: Extract the evaluation runner into Sevro](ADR-0010-extract-the-evaluation-runner-into-sevro.md) | Accepted | 2026-09-19 | Move generic evaluation infrastructure into the versioned Sevro package while Darrow retains its evaluation policy, cases, and product integration. | Supersedes: ADR-0001; Partially superseded by: ADR-0014 |
| [ADR-0011: Negotiate evaluation extensions across the runner boundary](ADR-0011-negotiate-evaluation-extensions-across-the-runner-boundary.md) | Accepted | 2026-09-26 | Keep evaluation execution and host observation in Sevro while a negotiated, versioned Darrow extension supplies repository policy without concealing failed or unavailable evidence. | None |
| [ADR-0012: Keep native goal ownership in the main thread](ADR-0012-keep-native-goal-ownership-in-the-main-thread.md) | Accepted | 2026-10-30 | Keep the native goal, acceptance criteria, user decisions, and completion in the main thread; delegate bounded work without transferring goal ownership. | Supersedes: ADR-0004 |
| [ADR-0013: Retire the Langfuse observability plugin](ADR-0013-retire-the-langfuse-observability-plugin.md) | Accepted | 2026-10-31 | Remove darrow-observability-langfuse and use configured native host OpenTelemetry exporters with session-start resource attributes for ticket attribution, accepting the loss of plugin-specific reconstruction and attribution features. | Supersedes: ADR-0008; Revisit when: A concrete telemetry requirement cannot be met by native host exporters and justifies a separately scoped integration with measured evidence. |
| [ADR-0014: Keep current documentation with its owner](ADR-0014-keep-current-documentation-with-its-owner.md) | Accepted | 2026-11-21 | Keep current rules with their owners, architectural rationale in ADRs, and completed investigations in Git history. | Partially replaces clauses in ADR-0006, ADR-0007 and ADR-0010 |
| [ADR-0015: Curate upstream workflows and retire duplicate providers](ADR-0015-curate-upstream-workflows-and-retire-duplicate-providers.md) | Accepted | 2026-11-21 | Curate pinned MIT upstream workflows and retain Darrow-specific capabilities instead of maintaining duplicate standalone providers. | None |
| [ADR-0016: Keep independent review separate from acceptance](ADR-0016-keep-independent-review-separate-from-acceptance.md) | Accepted | 2026-11-21 | Review standards and requested behavior independently, verify repairs against the original findings, and leave overall acceptance with the goal owner. | None |
| [ADR-0017: Limit automation to authorized admission](ADR-0017-limit-automation-to-authorized-admission.md) | Accepted | 2026-11-21 | Let Artificer admit nominated work under a saved recurring grant while the original native session owns engineering execution and recovery. | None |

## Rejected

<!-- prettier-ignore -->
| Decision | Status | Date | Summary | Relationships |
| --- | --- | --- | --- | --- |

## Deprecated

<!-- prettier-ignore -->
| Decision | Status | Date | Summary | Relationships |
| --- | --- | --- | --- | --- |

## Superseded

<!-- prettier-ignore -->
| Decision | Status | Date | Summary | Relationships |
| --- | --- | --- | --- | --- |
| [ADR-0001: Custom eval runner (TS/Bun) with harness adapters](ADR-0001-eval-runner.md) | Superseded | 2026-07-05 | Use a thin TypeScript-on-Bun eval runner with declarative YAML cases, real harness adapters, pinned model matrices, repeated trials, and outcome-based checks. | Superseded by: ADR-0010 |
| [ADR-0004: Use native goal ownership for core orchestration](ADR-0004-use-native-goal-ownership-for-core-orchestration.md) | Superseded | 2026-08-13 | Use Darrow to compile and launch one host-native goal owner instead of operating a second execution controller or general workflow runtime. | Superseded by: ADR-0012; Revisit when: Matched multi-trial evidence on supported hosts shows that a Darrow-owned execution controller materially improves task outcomes over native goal ownership after accounting for wall time, model usage, child invocations, and human interruptions. |
| [ADR-0005: Use portable Bash facades for plugin mechanics](ADR-0005-use-portable-bash-facades-for-plugin-mechanics.md) | Superseded | 2026-08-13 | Put deterministic plugin mechanics behind narrow portable Bash facades while keeping authority and contextual judgment in skills. | Superseded by: ADR-0009 |
| [ADR-0008: Allow Python and UV for Langfuse observability](ADR-0008-allow-python-and-uv-for-langfuse-observability.md) | Superseded | 2026-08-24 | Permit the independently installable Langfuse observability plugin to use a locked Python backend managed by UV while retaining a portable Bash hook launcher and keeping the exception scoped to that plugin. | Superseded by: ADR-0013; Revisit when: Codex exposes equivalent native Langfuse export, the Langfuse SDK no longer requires Python, or the plugin can meet its rollout-reconstruction and export contract with the portable Bash baseline alone. |
