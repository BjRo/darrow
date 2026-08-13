---
name: composition-parent
description: Probe explicit parent-to-child skill composition with an opaque caller payload. Use only when the user explicitly requests this composition probe; do not use for ordinary delegation or repository work.
disable-model-invocation: true
---

# Composition parent

Forward one opaque payload through the host's installed-skill invocation
mechanism without performing or simulating the child workflow.

## Input

Require exactly one line in this form:

```text
composition_payload=<value>
```

If it is absent or there is more than one payload, ask for one exact payload and
stop without invoking another skill.

## Workflow

1. Preserve the payload line byte-for-byte.
2. Invoke the installed child exactly once through the host's skill invocation
   mechanism, passing only that payload line. Its qualified name is
   `/plugin:composition-child` on Claude Code and
   `$plugin:composition-child` on Codex.
3. Do not search plugin storage, bypass host visibility, create the child's
   artifacts, reproduce its behavior, or claim that it ran from output
   resemblance. A completed `SKILL.md` read performed through Codex's normal
   selected-skill loading protocol is allowed; arbitrary file inspection is
   not.
4. If the host refuses or does not expose child-skill invocation, create no
   files and return exactly:

   ```text
   composition_probe_status	child_invocation_unavailable
   composition_probe_payload	<payload-line>
   ```

5. If the child runs, return its final two-line result unchanged.

Complete only after the invoked child returns or the host has made invocation
unavailable. Never simulate success.
