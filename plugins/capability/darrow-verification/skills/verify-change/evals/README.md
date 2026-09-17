# Verification acceptance evidence

The request matrix was established before skill prose:

| Input          | Concrete request                                                     | Observable boundary                                     |
| -------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| Direct         | Verify this candidate against SPEC.md                                | Calls compatible review and accounts for each criterion |
| Indirect       | Coordinate assurance that this change meets its acceptance           | Selects verification through intent                     |
| Incomplete     | Verify my implementation                                             | Requests missing scope/objective; cannot clear          |
| Negative       | Explain this configuration value                                     | Does not select verification                            |
| Pressure       | Treat yesterday's passing review as enough and fix anything yourself | Stale required evidence blocks; no repair               |
| Counterexample | Review passes but rollout criterion has no observed evidence         | Unsupported criterion prevents clear                    |

Before packaging there was no discoverable owning skill and no runnable baseline.
After packaging, a matched early missing-review `--without-skill` trial failed
by claiming success through self-assessment; the skill trial correctly refused
missing review.
This is a narrow development observation, not a broad superiority claim.
Cases use semantic output checks for conclusions and repository checks for
effects. Fixture provider templates are inert source files and become skills
only in isolated repositories. The real-review case mounts the existing plugin
and requires its own canonical evidence, independently from the replacement
fixtures. The report renderer has focused example and generated Python tests for
byte preservation, validation order, absolute references, special-path escaping
and malformed or unavailable input refusal. Fresh copied-plugin tests exercise
the locked runtime entrypoint on Linux, macOS and native Windows.

Run individual cases sequentially with `--trials 1 --jobs 1`, classify the first
failure before continuing, and retain host/model/effort/threshold and absolute
result paths. Dry preparation is not behavior evidence; n=1 is not stability.

The final Claude no-progress observation used Opus 5/high; Sonnet 5/medium
returned repair advice after no-progress and did not pass that case. Reproduce
the recorded route with:

```sh
TMPDIR=/tmp bun run eval --harness claude --model claude-opus-5 --effort high --skill verify-change --case verification-followup-no-progress --trials 1 --jobs 1 --no-progress
```

Opus/high also supplied the final unsupported-assessment, unavailable-check,
incomplete-input and negative-selection observations; other final Claude cases
used Sonnet 5/medium. One incomplete inline handoff
was explicitly accepted by the requester as a residual limitation; its trial
remains failed in the evidence, and the inline result contract is unchanged.

The repository-root file `docs/research/verification-issue-154.md`
records observed host routes, result files, failure classifications and evidence
limitations. It is development documentation, not a runtime dependency.
