# Work-through-decisions evals

The single public skill selects a mode by the user's requested outcome. These
cases cover the entry boundary and the original feature, planning, and grilling
contracts after moving their instructions into mode resources.

| Request                                      | Expected selection and behavior                   |
| -------------------------------------------- | ------------------------------------------------- |
| Explicit grilling of a named decision        | Skill loads; asks the current decision frontier   |
| Natural “grill me” or API stress-test        | Skill loads; uses standalone grilling             |
| Natural feature-specification request        | Skill loads; uses feature discovery               |
| Natural implementation-plan request          | Skill loads; uses implementation planning         |
| Grilling without a subject                   | Skill loads; asks only for the subject            |
| Ordinary advice or settled implementation    | Skill stays unselected                            |
| Pressure to skip questions or invent choices | Skill preserves frontier and authority boundaries |

The runner observes completed entry `SKILL.md` reads on Codex and native Skill
events on Claude Code. It does not yet retain reads of internal mode reference
files. Mode-specific semantic checks verify behavior, but cannot by themselves
prove that every resource was loaded.

The complete-brief and complete-plan cases grade direct evidence attribution separately from
needless repetition. Source citations are required provenance; observable
acceptance criteria, plan slices, risk mitigations, and the final outcome
restatement may reuse settled behavior for their distinct purposes.
Limited compatibility wording shared by a verification slice and the rollout
explanation is acceptable; duplicated constraint lists and substantial recaps
remain failures.
The same severity applies to briefs: isolated repetition of one constraint
and brief process asides do not block an otherwise valid artifact. Extended
process narration remains a failure; material evidence and provenance stay required.
The complete-brief format assertion accepts an unqualified fixed CSV format
without requiring the word “only.” Controls must still reject CSV offered as
a default or alongside another selectable format.
Calibrate edits to these semantic checks
against retained valid briefs and counterexamples with inspection chronology
or redundant decision recaps before running fresh candidate trials.
The complete-plan numeric boundary is semantic too: either positive integers
or the equivalent invalid-value exclusions count. Calibrate it against retained
plans and examples that wrongly allow zero or positive fractions.
The premature-brief pressure case keeps the user-set cross-cutting scope of a
policy separate from the policy value still awaiting a decision. A recommendation
may explain its effects while remaining advisory. Retain controls that falsely
claim acceptance and that defer independent decisions.
Frontier closure checks assess the response itself. A question and concrete
advisory recommendation can end the turn without announcing “I am stopping” or
“there is no brief.” Keep negative controls for premature artifacts and false
completion claims.
The round may contain other independent questions; its stopping boundary does
not impose a one-question limit.
Intent checks also accept prerequisite goal or constraint questions that advance
the named decision. They do not require an explicit mode label or force the
final choice before its prerequisites are known.

Run the full plugin surface with the shared eval runner:

```sh
bun evals/runner/run.ts --plugin darrow-discovery --harness codex --model gpt-6-luna --effort medium --trials 5
```

Repeat with Claude Code using an available Claude model and the same prompts,
fixtures, and trial count. Report task and activation outcomes separately.
