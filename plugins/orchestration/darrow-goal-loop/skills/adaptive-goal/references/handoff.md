# Enclosing host-API handoff

Read this reference only when an enclosing host API requests adaptive-goal
preflight. Keep the classifier turn read-only, return exactly this one object,
and stop the turn:

```json
{
  "format": "darrow-native-goal-handoff-v4",
  "workflow": "<workflow>",
  "risk": "<routine|elevated|high>",
  "profile": "<routine|routine-plus|scaled|repo-wide|judgment>",
  "routeSource": "<policy|user>",
  "readinessGate": {
    "selection": "<selected|omitted>",
    "reason": "<concise non-empty reason>"
  },
  "independentReview": {
    "selection": "<selected|omitted>",
    "reason": "<concise non-empty reason>"
  },
  "selectedRoute": {
    "harness": "<harness>",
    "provider": "<provider>",
    "model": "<concrete-model>",
    "effort": "<concrete-effort>"
  },
  "goalContract": "<complete contract without the readiness or review clauses; target 4,000 bytes without dropping requirements>"
}
```

Leave the `Readiness gate:` and `Independent review:` lines out of
`goalContract`. The enclosing launcher validates both structured decisions,
replaces any redundant classifier-written lines, and compiles the canonical
portable clauses. A high-risk handoff that omits review is invalid.

Add `roundLimit` as a positive integer only when the originating request
explicitly supplies that exact review-round limit. Omit it for selected
progress-bounded convergence and when review is omitted. The launcher validates
it against the request and fails closed on a missing, mismatched, ambiguous, or
unauthorized limit. It compiles both clauses without dropping requirements.

The enclosing launcher validates the route against the live host catalog and
policy profile, loads the exact selected workflow document, and materializes a
bounded inline or verified file-backed objective before its first goal-set
call. It sets the goal exactly once and starts the execution turn with that
workflow plus the selected model and effort. Keep a file-backed contract
readable until termination. The accepted turn request proves route application;
the workflow identifier, path, and content hash on that receiving turn prove
workflow loading. The handoff alone proves neither.
