# Repair-budget request matrix

The default permits at most two authorized repair attempts, with verification
after each. Every attempt after the first requires material progress. The
same policy applies to Codex contracts and the shipped Claude owner agents.

| Request                                                                        | Expected behavior                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Direct advice after one default repair resolved a blocker and narrowed another | Permit the second repair; withhold completion and publication until clear |
| Retained-owner continuation after a repair caused a direct regression          | Permit a second repair within authority and verify the regression         |
| Advice with unavailable verification evidence                                  | Stop rather than infer progress or spend another attempt                  |
| Ordinary request to explain a repair without orchestration invocation          | Do not activate adaptive delivery                                         |
| Keep trying after two default attempts with continuing progress                | Stop on exhausted budget                                                  |
| Explicit maximum of one or zero repairs                                        | Honor the lower limit                                                     |
| Explicit maximum of three repairs with progress after two                      | Permit the third attempt                                                  |
| Unchanged blockers after one repair with unused budget                         | Stop on no progress                                                       |

Colocated advice evals exercise budget decisions. The review-composition eval
and its fixture tests exercise actual repair/check/verification ordering and
current-target evidence. Ticket-to-PR delegates policy selection and preserves
explicit caller limits; it does not supply its own default.
