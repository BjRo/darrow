# Authoring evals

Run these cases with the shared repository runner, selecting
`--plugin darrow-skill-authoring`. Use one trial and one job while diagnosing,
and inspect each failure before starting the next case.

| Request boundary                                | Case                      |
| ----------------------------------------------- | ------------------------- |
| Direct skill creation                           | `create-focused-skill`    |
| Indirect reusable-workflow request              | `indirect-discovery`      |
| Missing goal, destination, and runtime support  | `refuse-undefined-skill`  |
| Ordinary agent guidance without skill intent    | `non-skill-guidance`      |
| Repair a skill with a sibling-plugin dependency | `repair-skill-boundaries` |
| Validation without mutation authority           | `validate-read-only`      |

## Shell evidence

The creation and repair fixtures inherit the host's interpreter availability.
Their shell-reporting checks therefore accept observed Bash 5 execution as
well as an explicit statement that Bash 5 remains unverified. Running `bash`
and `/bin/bash` does not by itself prove that two versions were exercised.
The semantic checks grade the final report; they cannot independently verify
its claims against the execution transcript. Inspect the retained matrix output
when assessing actual interpreter coverage.

Calibrate the shared reporting proposition with these bounded examples before
changing it:

| Report                                                                                                 | Expected |
| ------------------------------------------------------------------------------------------------------ | -------- |
| Observed Bash 3.2.57 and Bash 5.2.37; tests passed under each; coverage complete                       | Pass     |
| Observed Bash 3.2.57 passed; Bash 5 unavailable, unexecuted, and unverified                            | Pass     |
| Commands `bash` and `/bin/bash` passed; two-version coverage complete                                  | Fail     |
| Only real Bash 3.2 available; simulated Bash 5 labels passed, so real Bash 5 compatibility is verified | Fail     |

These are grader calibration examples, not evidence that those interpreters
executed a helper. The deterministic `interpreter-routing.test.sh` separately
launches both bundled suites with a conflicting `bash` on `PATH`, checks that
the suites pass, and rejects any invocation of that conflicting interpreter,
including calls hidden by expected-failure assertions. Run it through the
version-aware matrix alongside the other shell tests. The matrix tests' fake
version wrappers test reporting mechanics only.
