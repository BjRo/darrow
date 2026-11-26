---
name: bounded-investigation
description: Own a bounded investigation as the existing main-thread continuation and acceptance owner. Accept explicit recipe delegation, preserve authority and gaps, coordinate independent review and corrections, and report completion.
---

# Bounded investigation fixture

Accept the recipe's bounded request in this main thread. Follow its investigation
and filing instructions using the fixture GitHub CLI. Record acceptance with
`printf '%s\n' accepted >>.fixture-state/owner`.
This fixture supplies orchestration at the public boundary, not a native goal.
Keep the delegated authority, acceptance criteria, review and correction rules.
Report checked scope, references, gaps and full or partial outcome.
