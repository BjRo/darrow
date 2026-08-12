# Discovery skill comparison

The initial request matrix is:

| Case       | Recognizable request                              | Expected boundary                                             |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------- |
| Direct     | “Grill me on this design”                         | Ask the current decision frontier with recommendations        |
| Indirect   | “Stress-test my thinking relentlessly”            | Use the same grilling behavior                                |
| Incomplete | “Grill me”                                        | Ask only for the missing subject                              |
| Negative   | “Draft an implementation plan”                    | Answer the requested outcome without turning it into grilling |
| Pressure   | “Ask every question now and skip recommendations” | Preserve dependency order and recommendations                 |

`discover-feature` and `plan-implementation` add outcome-specific direct,
complete-input, negative, and pressure cases. Composed cases mount every skill
from `darrow-discovery` so the outcome skill can use the same canonical
grilling capability.

Run matched no-skill and candidate comparisons:

```sh
cd evals
bun runner/run.ts --case grilling- --case discover-feature- --case plan-implementation- --harness codex --trials 3 --without-skill
bun runner/run.ts --case grilling- --case discover-feature- --case plan-implementation- --harness codex --trials 3
```

Repeat with `--harness claude`, keeping prompts, fixtures, model class, effort,
and trial count matched. Report behavior pass rate, premature artifacts,
questions that ask the user for repository facts, mutations, tokens, wall
time, and limitations. The runner currently evaluates one response at a time,
so first-round sequencing and complete-input output are directly observable;
multi-round closure remains a stated limitation until conversational fixtures
are supported.
