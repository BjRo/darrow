---
name: principle-foundational-thinking
description: Load principle-foundational-thinking guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply foundational thinking

Settle the data shape and the required access patterns before building logic
on them. Use those choices to order a foundational feature's implementation
and verification.

Build only the foundations needed to deliver or verify the accepted task.
A possible future consumer is not sufficient reason for a new framework,
storage layer or general service. Preserve compatibility and expose any
necessary expansion beyond the accepted task as a decision for its owner.

Complete when: the needed data shape and access are explicit, and every new
foundation supports current delivery or verification.
