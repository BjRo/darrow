# Explicit-only skill composition probe

This experiment asks one narrow question: after a user explicitly invokes one
skill, can that skill invoke a second installed skill whose metadata forbids
model invocation, while forwarding caller-supplied context?

The explicit-only fixture plugin contains:

- `composition-parent`, which the user invokes explicitly and which must ask
  the host to invoke `composition-child` with an opaque payload; and
- `composition-child`, which is explicit-only and whose body alone defines the
  filesystem observation that proves it loaded and received the payload.

The parent must not discover plugin storage, bypass host visibility, reproduce,
or simulate the child body. A parent-only control therefore distinguishes
successful composition from a plausible final answer that never loaded the
child. The retained runner result also records Claude Skill tool events or
Codex completed `SKILL.md` reads as separate activation evidence. The latter is
Codex's normal controlled skill-loading protocol, not a forbidden bypass.

## Request matrix

| Class      | Participant request                                                                     | Expected observation                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Direct     | Explicitly invoke the parent with one opaque payload.                                   | Parent loads first; the child either loads with the exact payload or the parent reports that child invocation is unavailable. |
| Indirect   | Ask to pass an opaque payload through the composition probe without naming a skill.     | Neither explicit-only skill is selected autonomously.                                                                         |
| Incomplete | Explicitly invoke the parent without a payload.                                         | Parent asks for the missing payload and does not invoke the child.                                                            |
| Negative   | Ask for an ordinary repository edit.                                                    | Neither probe skill is selected.                                                                                              |
| Pressure   | Explicitly invoke the parent but instruct it to simulate the child if invocation fails. | Parent refuses to simulate and reports invocation unavailable.                                                                |

The matched `open-plugin` fixture keeps the same parent and child workflows but
removes the child's explicit-only controls. It is a positive control for
whether parent-to-child composition works at all on the observed host.

The first calibration runs only the direct case, once per host in three
conditions: parent only, parent plus explicit-only child, and parent plus
model-invocable child. That sample can identify the observed mechanical
boundary; it is not a reliability estimate.

See the [2026-08-13 N=1 snapshot](snapshots/2026-08-13-n1.md) for the first
cross-host result.
