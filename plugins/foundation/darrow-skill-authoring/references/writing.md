# Writing agent-facing skill prose

Use this reference while drafting or auditing a `SKILL.md`, its description,
or a linked reference. Every sentence an agent reads either changes what the
agent does or spends attention for nothing. These levers decide which.

## Descriptions are pointers

The description is always loaded. Its wording, not the body, decides when the
agent reaches the skill.

- Lead with the recognizable goal, then name each distinct request branch once.
  Synonyms for one branch are one branch; keep the clearest word.
- Name an exclusion only where a neighboring request would plausibly select
  the skill.
- Leave ordered steps, questions, and output rules to the body.

## Steps above reference

`SKILL.md` holds what every run needs: inputs, ordered steps, ask and stop
rules, and output. Material that only some runs reach, such as one runtime's
packaging rules or one rare recovery path, moves to `references/` behind one
line naming when to read it. Keep a concept's definition, rules, and caveats
under one heading.

## Completion criteria carry the bar

End each phase with a criterion the agent can check. Make it demanding where
thoroughness matters: "every changed entrypoint has a passing test" drives
more work than "tests added." A vague bound invites the agent to stop early.

## Steer with the target

State the behavior you want: "Report the absolute `SKILL.md` path," not "Do
not report only the skill name." A prohibition names the unwanted behavior and
makes it more available. Keep one only as a guardrail with no positive form,
and pair it with the target.

When an eval shows a near miss, write the rule at the point of use and name
the acceptable result: "Ask for the goal, destination, and hosts together; a
hosts-only question leaves the gate open."

## Anchor words

Reuse one established term for a repeated idea instead of re-explaining it.
Prefer a word the model already knows (_baseline_, _red_, _handoff_) to a
coined one, which costs definition text on every read.

## One source, current facts

- State each meaning once. A repeated rule costs maintenance and looks more
  important than it is.
- Leave facts the environment states, such as manifests, scripts, directory
  layout, and `--help` output, to the environment. Write down what it cannot
  show: the unwritten convention, the reason, the gotcha.
- Remove a sentence the model already follows by default. Test it by deleting
  the whole sentence and rerunning the affected eval. Keep it if a check goes
  red.

## Pruning pass

Guidance only grows when each fix adds a sentence. After the focused checks
pass:

1. List candidate sentences: repeats, defaults, restated environment facts,
   and old near-miss patches.
2. Remove one candidate or a small related group.
3. Rerun the matched evals that cover that behavior.
4. Restore any sentence whose removal turns a check red, rewritten as a
   positive rule at its point of use.

When live reruns are unavailable, keep the candidates and report the pass as
unverified.
