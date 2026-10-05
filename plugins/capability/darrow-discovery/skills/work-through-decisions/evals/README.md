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

Run the full plugin surface with the shared eval runner:

```sh
bun evals/runner/run.ts --plugin darrow-discovery --harness codex --model gpt-6-luna --effort medium --trials 5
```

Repeat with Claude Code using an available Claude model and the same prompts,
fixtures, and trial count. Report task and activation outcomes separately.
