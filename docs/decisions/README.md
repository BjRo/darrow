# ADR Catalog

This checked-in catalog is derived, non-authoritative metadata. ADR files remain canonical.
Rebuild it with `decision catalog rebuild` and verify it with `decision catalog check`.

<!-- darrow-adr-catalog-v1 -->

## Proposed

<!-- prettier-ignore -->
| Decision | Status | Date | Summary | Relationships |
| --- | --- | --- | --- | --- |

## Accepted

<!-- prettier-ignore -->
| Decision | Status | Date | Summary | Relationships |
| --- | --- | --- | --- | --- |
| [ADR-0001: Custom eval runner (TS/Bun) with harness adapters](ADR-0001-eval-runner.md) | Accepted | 2026-07-05 | Use a thin TypeScript-on-Bun eval runner with declarative YAML cases, real harness adapters, pinned model matrices, repeated trials, and outcome-based checks. | None |
| [ADR-0002: Separate capabilities from orchestration](ADR-0002-separate-capabilities-from-orchestration.md) | Accepted | 2026-08-13 | Keep capabilities intent-matched and independently selectable while starting continuation-owning orchestration only through explicit user invocation. | None |
| [ADR-0003: Treat plugins as optionality boundaries](ADR-0003-treat-plugins-as-optionality-boundaries.md) | Accepted | 2026-08-13 | Treat each plugin as a self-contained unit of adoption, compatibility, and ownership that composes through host-visible skill intent rather than sibling dependencies or a separate capability registry. | None |
| [ADR-0004: Use native goal ownership for core orchestration](ADR-0004-use-native-goal-ownership-for-core-orchestration.md) | Accepted | 2026-08-13 | Use Darrow to compile and launch one host-native goal owner instead of operating a second execution controller or general workflow runtime. | Revisit when: Matched multi-trial evidence on supported hosts shows that a Darrow-owned execution controller materially improves task outcomes over native goal ownership after accounting for wall time, model usage, child invocations, and human interruptions. |
| [ADR-0005: Use portable Bash facades for plugin mechanics](ADR-0005-use-portable-bash-facades-for-plugin-mechanics.md) | Accepted | 2026-08-13 | Put deterministic plugin mechanics behind narrow portable Bash facades while keeping authority and contextual judgment in skills. | Revisit when: Every supported Claude Code and Codex host provides a common, independently installable runtime that is more portable than Bash 3.2 plus baseline Unix utilities, or the supported macOS boundary no longer includes Bash 3.2. |
| [ADR-0006: Keep decisions with their authoritative owners](ADR-0006-keep-decisions-with-their-authoritative-owners.md) | Accepted | 2026-08-13 | Keep each decision at the narrowest durable authoritative owner its consumers obey, with one canonical sink per effect and honest gaps for inaccessible owners. | None |
| [ADR-0007: Separate skill evaluation evidence dimensions](ADR-0007-separate-skill-evaluation-evidence-dimensions.md) | Accepted | 2026-08-13 | Represent invariant coverage, task outcomes, matched skill ablation, and skill activation as separate evaluation evidence dimensions. | None |
| [ADR-0008: Allow Python and UV for Langfuse observability](ADR-0008-allow-python-and-uv-for-langfuse-observability.md) | Accepted | 2026-08-24 | Permit the independently installable Langfuse observability plugin to use a locked Python backend managed by UV while retaining a portable Bash hook launcher and keeping the exception scoped to that plugin. | Revisit when: Codex exposes equivalent native Langfuse export, the Langfuse SDK no longer requires Python, or the plugin can meet its rollout-reconstruction and export contract with the portable Bash baseline alone. |

<!-- darrow-source: 1a57cf608fb4cfa4b770abebf34ca450e79c0160 2711262332 330 ADR-0001-eval-runner.md -->
<!-- darrow-source: cd9996efb2f66b1602ead9a405a48686e14f67a9 1820997609 370 ADR-0002-separate-capabilities-from-orchestration.md -->
<!-- darrow-source: 452327e39a9dff558c6897356d0e1e85cf65906f 3673420192 418 ADR-0003-treat-plugins-as-optionality-boundaries.md -->
<!-- darrow-source: 42bc1095831a4d097a6bda6462d29315bc0f0529 2382776868 628 ADR-0004-use-native-goal-ownership-for-core-orchestration.md -->
<!-- darrow-source: 1aa2b5acc9ffef09063953d78bfe04c26cab4089 3642678449 590 ADR-0005-use-portable-bash-facades-for-plugin-mechanics.md -->
<!-- darrow-source: 739b2fa46ad8b0ed220c4d341317bf670d3d7a41 243106577 398 ADR-0006-keep-decisions-with-their-authoritative-owners.md -->
<!-- darrow-source: ae5948d48fa4b0b0ce2c80ea76e23a71d582aa71 4074249863 369 ADR-0007-separate-skill-evaluation-evidence-dimensions.md -->
<!-- darrow-source: aab600b869cf357f81f4424f1813a75596d0a64c 2479862079 646 ADR-0008-allow-python-and-uv-for-langfuse-observability.md -->

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
