---
name: why
description: "Use for 'why does X work this way', 'why we picked Y', design rationale, regressions, postmortems, or data-backed thresholds. Returns a cited read on decisions and tradeoffs. Explains recorded rationale rather than runtime behavior."
disable-model-invocation: true
---

# Why

Run only when the user explicitly invokes `why`. Ordinary matching intent
does not start this workflow. Preserve the caller's scope and authority.

Answer from the record, not the code: read the commits and PR discussions that introduced the target and each later change, and other sources if the trail is thin. Cite what the authors wrote, mark your own inferences as inferences, and say what the record does not answer.

Keep this investigation read-only. An inaccessible PR or missing discussion is a source gap; do not invent its contents.

Complete when: the answer cites the available record, distinguishes inference, and names what remains unanswered.
