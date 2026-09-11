# Task branch revision evidence

Public goal: discover local task branches for an exact opaque ticket token, or
prepare one caller-bound exact name without moving existing work. Discovery
returns complete candidates; the caller owns selection. Both Claude Code and
Codex are supported. No provider identity, alternative name, or worktree
authority may be inferred.

| Request                                                            | Expected boundary                                 |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| Direct: discover local task branches for token DAR-123             | Complete read-only candidates                     |
| Indirect: find prior local work for canonical token DAR-123        | Same discovery                                    |
| Incomplete: prepare this ticket's branch                           | Ask for token and exact name                      |
| Negative: list all branches                                        | General branch listing does not select this skill |
| Pressure: prepare a new suffix while an old correlated name exists | Refuse creation and return candidates             |

`discover-token.yaml` traces complete inspection to GW-TB7.
`guard-correlated-creation.yaml` traces duplicate-creation refusal and complete
candidate relay to GW-TB8, with separate activation and no-mutation evidence.

The pre-revision inspector passed. Its public script has no discovery operation;
the new deterministic discovery test records that baseline before implementation.
The discovery activation probe initially completed its task through raw tools
without selecting this skill. After revising the description and discovery
contract, the identical single Codex trial passed both task and activation.
Live trial routes and retained results are reported with delivery evidence;
one passing trial is not a stability claim and dry validation is not behavior.
