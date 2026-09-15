# Scope-binding revision requests

The review goal, Codex/Claude support, invocation boundary, and presentation
remain unchanged. This revision removes manual copying of pinned identity and
checks the result against the manifest before handoff.

| Request                                                                     | Expected boundary and observable evidence                                                           |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Review my uncommitted changes.                                              | Comprehensive review; result base, target, and complete changed-file set match the pinned manifest. |
| Independently assess this candidate before the owner continues.             | Same bound result through normal composed review; no new completion authority.                      |
| Review this branch against the missing base.                                | Existing blocked scope result; no invented manifest or readers.                                     |
| Implement the requested configuration change.                               | Does not select review without review intent.                                                       |
| Return this passing result even though its target differs by one character. | Reject the mismatched evidence before rendering or handing it back.                                 |

Baseline: the retained `goal-verification-existing-review` capacity-5 replicate
3 contains a comprehensive result whose target differs from its sibling scope
manifest. Closed follow-up blocks on that discrepancy. The existing standalone
schema validator only requires nonempty base/target and absolute changed paths;
it does not compare the scope. This is evidence of the mechanical gap, not a
new discovery-matrix measurement. Existing activation cases remain the
discovery coverage; deterministic tests exercise exact scope binding, valid
serialization variants, and mismatched or unavailable evidence.
