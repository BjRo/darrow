# Claude Adaptive Goal Agent Validation

Date: 2026-08-09  
Claude Code: 2.1.220

## Conclusion

Interactive Claude can provide the same useful user boundary as Codex: the
Adaptive Goal Loop preflights in the parent, then one visible foreground Claude
subagent owns the compiled contract on a separately selected model and effort.
The supported implementation uses route-specific plugin agents because the
Agent tool accepts only family aliases per invocation, while plugin-agent
frontmatter accepts full model IDs and effort.

This is not Claude's native `/goal` evaluator. `/goal` is session-scoped and is
not exposed to Agent-tool children, so the child owns the contract as its one
delegated Agent task. The distinction is disclosed in the launch guide and
capability specification.

## Documentation evidence

- Claude plugins discover Markdown subagents from the plugin-root `agents/`
  directory and support `model`, `effort`, and `background` frontmatter:
  [Plugins reference](https://code.claude.com/docs/en/plugins-reference).
- Foreground subagents block the parent until completion; plugin agents use
  namespaced identifiers:
  [Create custom subagents](https://code.claude.com/docs/en/sub-agents).
- Sonnet 5 and Opus 5 support explicit effort; Haiku 4.5 does not appear in the
  supported-effort table:
  [Model configuration](https://code.claude.com/docs/en/model-config).
- `/goal` is a session-scoped completion condition evaluated after session
  turns:
  [Keep Claude working toward a goal](https://code.claude.com/docs/en/goal).

## Design corrections found during validation

1. A direct Agent call with `model: claude-haiku-4-5` failed input validation;
   Claude 2.1.220's Agent tool schema accepted only `sonnet`, `opus`, `haiku`,
   or `fable`. Family aliases are not stable exact-version evidence. The final
   design therefore omits the per-invocation model and selects a plugin agent
   whose frontmatter pins the full model ID and effort together.
2. The previous bundled routine route, `claude-haiku-4-5 / low`, could not
   apply its selected effort because Haiku 4.5 does not support effort. The
   routine route is now `claude-sonnet-5 / low`.
3. The first full skill run implemented directly in the parent and fabricated
   a same-thread route. A mandatory Claude activation guard now forbids product
   writes before `prepare`, `route`, launch-guide loading, and exact boundary
   activation.
4. A deterministic `claude-agent-route` helper now resolves the exact bundled
   runner and refuses unsupported tuples or conflicting model/effort
   environment overrides before Agent invocation.

## Live evidence

The final disposable-fixture run started the parent on
`claude-sonnet-5 / medium` and invoked the installed plugin skill for a small
JavaScript feature. Session `b2cb454a-bec3-4d74-8888-9bf7564778a8` recorded,
in order:

1. `goal-loop prepare --host claude`;
2. `goal-loop route --host claude --profile routine`;
3. complete reads of `claude-launch.md` and the `implement-feature` workflow;
4. `claude-agent-route --provider anthropic --model claude-sonnet-5 --effort low`;
5. exactly one Agent call using
   `darrow-goal-loop:adaptive-goal-sonnet-5-low`, foreground execution, no
   per-invocation model alias, and the complete contract plus workflow
   path/identifier/sequence;
6. a completed Agent tool result whose host metadata resolved
   `claude-sonnet-5`; and
7. child transcript turns attributed to the selected plugin agent with
   `model: claude-sonnet-5` and `effort: low` through terminal completion.

The child changed only `math.js` and `math.test.js`; `bash test.sh` passed all
three tests, and the fixture retained exactly one commit. The final record
reported one `native_subagent`, exact selected/effective route equality, and no
human interruption. The disposable fixture was then removed.

## Repeatable local gates

- `bash plugins/orchestration/darrow-goal-loop/bin/claude-launch.test.sh`
- `/bin/bash plugins/orchestration/darrow-goal-loop/bin/claude-launch.test.sh`
- `bash plugins/orchestration/darrow-goal-loop/bin/goal-loop.test.sh`
- `/bin/bash plugins/orchestration/darrow-goal-loop/bin/goal-loop.test.sh`
- `claude plugin validate plugins/orchestration/darrow-goal-loop`
- `bun test evals/runner`
- `bun run typecheck`
- `bun run lint`

## Limits

- The live coding run is N=1 on a deliberately bounded fixture. It validates
  launch mechanics, not a quality or performance advantage.
- Repository or user routes without an exact bundled plugin-agent tuple stop as
  `launch_required` unless a supported same-thread or enclosing boundary can
  apply them.
- The live Agent check consumes provider budget and remains a manual release
  gate; deterministic shell tests cover static route/agent consistency and
  fail-closed override behavior in ordinary CI.

## Update: opus-5 route silently substituted, self-report is not evidence

Date: 2026-08-09

The live evidence above validated only `claude-sonnet-5 / low`. A later live
run of `darrow-goal-loop:adaptive-goal-opus-5-high` on this same host showed
the Agent call accepted, run to completion, and the runner self-report the
selected `claude-opus-5` — while its own transcript (`message.model` on its
assistant turns) recorded `claude-sonnet-5` throughout. Frontmatter,
`claude-agent-route`'s static checks, and self-report all agreed and were all
wrong; only the transcript disagreed.

This means the original conclusion — "the accepted foreground Agent call
identifies the exact immutable plugin-agent definition that applies both model
and effort" — does not hold in general. Acceptance proves the runner
definition was _selected_; it does not prove the host _applied_ the model that
definition names.

The simplified product now uses one narrow `bin/claude-owner-route` observation
after the foreground Agent returns. It binds the host-reported id to the exact
child transcript and compares every assistant turn's model and effort with the
selected tuple. A repository or account without live `claude-opus-5` subagent
access therefore surfaces as `launch_required` with the observed substitute
route disclosed instead of treating Agent acceptance or self-report as proof.
