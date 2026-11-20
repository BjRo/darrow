---
name: principle-attack-the-premise
description: Load principle-attack-the-premise guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply attack the premise

When at least two fixes sharing a premise fail the same acceptance check,
challenge that premise before another authorized fix. State the assumption
explicitly and identify a concrete observation that would falsify it. Use
available evidence or an authorized diagnostic to distinguish the assumption
from what the failure actually proves.

For example, two cache changes failing a restart check warrant testing whether
the authoritative value is persisted independently of that cache. Repeating a
variation of the same fix does not test that premise.

This guidance grants no additional repair attempt. If the owner's repair
allowance is exhausted, report the premise and proposed falsifying check;
do not implement another fix. Preserve scope, authority, required assurance,
stop conditions and completion ownership.

Complete when: the shared premise and a falsifying observation are explicit,
and every next action remains within the owner's existing limits.
