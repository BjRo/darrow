# Repair-guidance request matrix

| Request                                                                      | Expected boundary                               | Evidence                                                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Review my uncommitted changes against the supplied requirement               | Both readers provide supported repair reasoning | both-axes                                                                     |
| Check whether this change violates our stdout policy                         | Standards review supplies bounded advice        | both-axes; repair-guidance-uncertain separately probes unknown repair details |
| Verify a repaired endpoint without its required external check               | Missing check evidence blocks                   | fix-verification-unavailable                                                  |
| Implement the requested change                                               | Review does not activate merely after editing   | no-trigger-after-edit                                                         |
| Verify an alternative implementation that satisfies the original requirement | The suggested implementation remains advisory   | repair-guidance-alternative                                                   |
| Verify adoption of the suggested approach while a required case still fails  | Original behavior determines resolution         | repair-guidance-unresolved                                                    |

The shell regression covers preservation, malformed fields, legacy records,
Markdown escaping, and immutable guidance across the verification chain.
Live evals cover the reviewer judgment that serialization cannot establish.
