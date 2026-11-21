---
name: principle-prove-it-works
description: Load principle-prove-it-works guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply prove it works

Check the actual artifact and current observable behavior that directly prove
the accepted property. Treat inherited success claims as claims to verify
against the current candidate.

Static evidence establishes static properties. Compilation can prove a
type-level acceptance property, but it cannot alone prove runtime behavior or
that a value survives persistence and restart. Choose evidence that observes
the property being claimed and report gaps honestly.

Evidence for a runtime persistence claim must include executing the relevant
accepted operation on the current candidate and inspecting the resulting
durable records. Check survival across restart when that is part of acceptance.

Keep required verification and independent review contracts intact. This
guidance does not replace their readers, gates, stop rules or completion owner.

Complete when: every success claim is supported by current evidence that
actually observes its accepted property.
