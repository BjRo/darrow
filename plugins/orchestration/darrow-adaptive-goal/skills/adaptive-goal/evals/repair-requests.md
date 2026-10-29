# Repair-budget request matrix

The default permits at most two authorized repair attempts, with verification
after each. Every attempt after the first requires material progress. Adaptive
Goal ships no budget calculator; the rule is arithmetic in the lifecycle
reference.

| Request                                                    | Expected behavior                                      | Evidence                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| Live blocking review, one repair, clear follow-up          | Repair once through the retained implementor, complete | `review-repair-rereview`, `placement-repair-reuse`                 |
| Advice after the shared default budget is exhausted        | Stop on exhausted budget                               | `verification-shared-exhausted`                                    |
| Advice with unavailable, stale or oscillating evidence     | Stop rather than infer progress or spend an attempt    | `verification-missing-evidence`, `-stale-evidence`, `-oscillation` |
| Advice when the first verification is clear                | Stop repairing; unused attempts are not required       | `verification-clear-first`                                         |
| Placement switch or replacement worker during repair       | No fresh allowance; no self-review                     | `placement-repair-allowance`, `placement-repair-self-review`       |
| Ordinary request to explain a repair without orchestration | Do not activate adaptive goal                          | `ordinary-engineering-nonactivation`                               |

The budgeted-repair advice cases and the `repair-budget` calculator were
removed with advice-mode repair procedure. Ticket-to-PR delegates policy
selection and preserves explicit caller limits; it does not supply its own
default.

Sevro 1.1.1 permits `SendMessage` for Claude candidates, resolving the tool
restriction tracked in [sevro#157](https://github.com/BjRo/sevro/issues/157).
The `placement-repair-reuse-claude` case still requires a native Claude trial
to establish retained-implementor repair behavior. Earlier failures retain
their original Sevro version and meaning.
