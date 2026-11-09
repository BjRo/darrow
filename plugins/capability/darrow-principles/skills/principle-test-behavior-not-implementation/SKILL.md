---
name: principle-test-behavior-not-implementation
description: Load principle-test-behavior-not-implementation guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply test behavior not implementation

Exercise observable contracts through their stable public seams. Use expected
results grounded independently in the requirement or fixture rather than
repeating the production algorithm in the assertion.

Avoid private-method, internal call-order or incidental-structure assertions
unless that detail is itself part of the public contract. A useful test should
survive an implementation change that preserves the promised behavior.

Complete when: the test distinguishes a broken observable contract from a
correct implementation using an independent expected result.
