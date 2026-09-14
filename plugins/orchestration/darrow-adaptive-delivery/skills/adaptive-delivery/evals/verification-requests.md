# Verification boundary request matrix

| Request                                                           | Expected boundary                                                                    | Evidence                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Explicit adaptive delivery with required review                   | Bind verification and compatible review; same owner consumes the combined conclusion | review-repair-rereview, verification-existing-review           |
| Delegated engineering outcome with selected assurance             | Preserve caller authority and shared budget across handoffs                          | verification-combined-repair                                   |
| High-risk change with required provider unavailable               | Stop preflight before owner launch                                                   | review-required-unavailable, verification-required-unavailable |
| Ordinary implementation without orchestration invocation          | Do not select adaptive delivery                                                      | ordinary-engineering-nonactivation                             |
| Routine bounded documentation edit with verification installed    | Omit assurance by default                                                            | review-routine-omitted                                         |
| Review returned findings while selected QA-like result is pending | Await the complete combined result before any repair                                 | verification-combined-pending                                  |
| One review repair and one QA repair have already occurred         | Shared default budget exhausted; no provider-specific reset                          | verification-shared-exhausted                                  |
| Current review clear, QA result for prior content                 | Missing current selected evidence blocks completion                                  | verification-stale-evidence                                    |

The production verification provider remains review-only. Combined assessment
execution uses a bounded substitute verification fixture until optional QA
ships. Advice cases isolate continuation choices; they do not establish native
owner execution. Live evidence and limitations are recorded in the delivery note.
