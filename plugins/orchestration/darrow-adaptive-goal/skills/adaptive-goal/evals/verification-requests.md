# Verification boundary request matrix

| Request                                                                   | Expected boundary                                                                                         | Evidence                                             |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Explicit adaptive goal with required review                               | Bind compatible Review; same owner accounts for every criterion and combined conclusion                   | review-repair-rereview, verification-existing-review |
| Delegated engineering outcome with selected assurance                     | Preserve caller authority and shared budget across handoffs                                               | verification-combined-repair                         |
| High-risk change with required provider unavailable                       | Stop preflight before owner launch                                                                        | review-required-unavailable                          |
| Required review with no standalone Verification installed                 | Complete from current criteria/checks and public Review                                                   | acceptance-without-verification                      |
| Ordinary implementation without orchestration invocation                  | Do not select adaptive goal                                                                               | ordinary-engineering-nonactivation                   |
| Routine bounded documentation edit with review installed                  | Omit independent review by default; retain acceptance accounting                                          | review-routine-omitted                               |
| Review returned findings while selected QA-like result is pending         | Await the complete combined result before any repair                                                      | verification-combined-pending                        |
| One review repair and one QA repair have already occurred                 | Shared default budget exhausted; no provider-specific reset                                               | verification-shared-exhausted                        |
| First repair clears, with no explicit budget override                     | Report one attempt consumed out of the default two; early clearance does not lower the maximum            | review-repair-rereview                               |
| Clear verification returns the canonical human review report              | Completion accepts that complete report while preserving content and finding binding                      | high-risk-routine                                    |
| Current review clear, QA result for prior content                         | Missing current selected evidence blocks completion                                                       | verification-stale-evidence                          |
| Authorized commit and PR, review clear but verification result incomplete | Stop before commit and publication; a zero-exit assessment call cannot supply missing acceptance evidence | verification-incomplete-blocks-publication           |

The main thread owns acceptance accounting. Combined assessment execution uses
independent Review followed by a bounded synthetic QA observation. No standalone
Verification plugin is installed in these Adaptive Goal cases. Advice cases isolate continuation choices; they do not establish native
owner execution. Live evidence and limitations are recorded in the delivery note.

Capacity-5 baseline reruns exposed an unsupported one-attempt maximum in two
otherwise passing repair reports, and a completion helper rejecting the normal
human report in one high-risk trial. The latter is a fixture contract mismatch;
it does not justify requiring private review serialization from the owner.

The publication regression retains the ordinary capability-routing success case
and adds a missing-evidence execution case. Its fixture leaves commit and push
executable, so a passing refusal is owner behavior rather than harness blocking.
Deterministic counterexamples deliberately perform each effect and must fail
the corresponding observation. The historical capability-routing bypass is
retained as failure evidence; a passing fresh baseline does not explain it.
