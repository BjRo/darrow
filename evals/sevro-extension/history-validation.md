# Historical result reader validation

Darrow can interpret retained legacy arrays, suite manifests, and completed-trial
checkpoints through the documented legacy report command's `--json` option.
The standalone reader uses only its two Darrow-owned files, without the generic
runner, a Sevro installation, Git metadata, host execution, or credentials.
It writes JSON or Markdown to standard output and preserves archive bytes.

## Observed test-first slices

Each command below ran with the new public-command test present before its
product change. The red failure and subsequent green use the same literal Bun
command. Check receipts retain the observed exit and diagnostic. Fixtures use
synthetic archived evidence and never call a model.

1. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "historical report JSON retains explicit manifest provenance"`:
   the legacy report rejected `--json`.
   Green — `bun test evals/runner/parity/sevro-history.test.ts -t "historical report JSON retains explicit manifest provenance"`:
   one test passed with seven assertions.
2. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "standalone historical arrays leave missing provenance"`:
   the interpreter treated a result array as a suite manifest.
   Green — `bun test evals/runner/parity/sevro-history.test.ts -t "standalone historical arrays leave missing provenance"`:
   one test passed with four assertions; absent provenance and measured rates stayed unknown.
3. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "historical execution conflicts"`:
   a dry manifest overrode explicit executed evidence.
   Green — `bun test evals/runner/parity/sevro-history.test.ts -t "historical execution conflicts"`:
   one test passed with three assertions; contradictory declarations retained a diagnostic and no measured rate.
4. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "a retained legacy checkpoint"`:
   the checkpoint format was unsupported.
   Green — `bun test evals/runner/parity/sevro-history.test.ts -t "a retained legacy checkpoint"`:
   one test passed with three assertions; even a planned single trial remained partial.
5. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "complete historical suites separate task quality"`:
   the view lacked completeness, separate metrics, and retained grader evidence.
   Green — `bun test evals/runner/parity/sevro-history.test.ts -t "complete historical suites separate task quality"`:
   one test passed with four assertions. A correct task with missing bookkeeping had quality one, protocol zero, and bookkeeping zero.
6. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "unavailable legacy semantic grading"`:
   unavailable grading still produced a measured task-quality or protocol rate.
   Green — `bun test evals/runner/parity/sevro-history.test.ts -t "unavailable legacy semantic grading"`:
   two tests passed with eight assertions, retaining null rates and the original grading diagnostic.
7. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "historical reporting remains usable"`:
   the independently copied reader wrote JSON when Markdown was requested.
   Green — `bun test evals/runner/parity/sevro-history.test.ts -t "historical reporting remains usable"`:
   one test passed with eight assertions. Its isolated JSON view matched the legacy command; Markdown retained unknown values and provenance.
8. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "missing historical cell inputs"`:
   diagnostics named the manifest instead of the missing child input.
   Green — `bun test evals/runner/parity/sevro-history.test.ts -t "missing historical cell inputs"`:
   one test passed with five assertions; the missing absolute path and null digest stayed visible alongside valid peers.
9. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "unrecognized historical formats"`:
   an unrelated comparison format acquired suite provenance.
   Green — `bun test evals/runner/parity/sevro-history.test.ts -t "unrecognized historical formats"`:
   one test passed with five assertions; the input retained its digest and explicit unsupported-format diagnostic.
10. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "null historical checks"`:
    null checks became an empty passing list.
    Green — `bun test evals/runner/parity/sevro-history.test.ts -t "null historical checks"`:
    one test passed with four assertions; recorded claims stayed visible while measured rates stayed null.
11. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "contradictory legacy trial success"`:
    a recorded pass contradicted failed harness or check evidence without an unsuccessful interpretation.
    Green — `bun test evals/runner/parity/sevro-history.test.ts -t "contradictory legacy trial success"`:
    two tests passed with six assertions, preserving recorded facts and null measured rates.
12. Red — `bun test evals/runner/parity/sevro-history.test.ts -t "invalid historical structure"`:
    invalid checks, trial numbering, or cell exits did not produce an unsuccessful interpretation.
    Green — `bun test evals/runner/parity/sevro-history.test.ts -t "invalid historical structure"`:
    four tests passed with sixteen assertions and input-bound diagnostics.

## Additional coverage

Public-command guards cover dry evidence, incomplete or interrupted suites,
missing terminal exits, executed standalone arrays without a planned boundary,
and malformed JSON beside valid relative-path inputs. They preserve recorded
summary claims, content digests, and archive bytes without measured success.
These guards make no additional test-first red claim.

After the green slices, lint required smaller functions for completion
validation and Markdown rendering, and a bounded cell context instead of five
parameters. The affected history and existing legacy report tests passed again
after refactoring. The installed review helper updated from 0.8.1 to 0.8.2
during the work; later check receipts use the replacement helper.

## Review repairs

Independent review identified three blocking records covering two gaps:
semantic assessments could disagree with named checks and still produce
measured success, and malformed cell exits escaped validation when their
linked result array was empty.

Red — `bun test evals/runner/parity/sevro-history.test.ts -t "historical semantic outcomes must agree"`:
contradictory or malformed semantic evidence was interpreted successfully.
Green — `bun test evals/runner/parity/sevro-history.test.ts -t "historical semantic outcomes must agree"`:
all three fixture variants passed through both entrypoints. Named verdicts
are validated and reconciled with recorded checks; invalid rows retain their
original semantic facts, diagnostics, and null measured rates. Valid peer
inputs remain visible and input bytes remain unchanged.

Red — `bun test evals/runner/parity/sevro-history.test.ts -t "empty historical result cells"`:
the malformed cell exit was accepted when its result array was empty.
Green — `bun test evals/runner/parity/sevro-history.test.ts -t "empty historical result cells"`:
one test passed with twelve assertions through both entrypoints. Cell exits
are validated before mapping results, without fabricating an empty case row.
The view retains the empty input's digest and valid peer measurements, with
unchanged archive bytes.

Additional controls preserve consistently failed semantic trials, keep
advisory and activation failures separate from task success, and leave absent
semantic assessments or corresponding check outcomes unmeasured. These controls
make no additional test-first red claim.

## Limits

The reader reports archival facts and does not establish comparison eligibility,
a current Sevro identity, historical numerical equivalence, or live model
stability. Standalone arrays may identify execution but lack a complete planned
run boundary. Checkpoints always remain partial. Unsupported comparison
snapshots remain readable in their original JSON and Markdown formats.

The normal evaluator commands, published release pin, and generic runner
removal remain pending. See [migration.md](migration.md) for the remaining
cutover gates.
