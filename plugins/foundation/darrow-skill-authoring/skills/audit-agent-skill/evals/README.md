# Skill audit evals

Each case mounts both `audit-agent-skill` and `create-agent-skill`. Positive
cases require the read-only audit skill and exclude creation. Negative cases
exclude every read of either skill, including a secondary read after another
skill. Run one Luna/medium trial per case while diagnosing, then five fresh
trials per case for the reliability claim.

| Boundary                                                 | Case                              |
| -------------------------------------------------------- | --------------------------------- |
| Read-only audit of vague metadata and unsafe publication | `validate-read-only`              |
| Authorized, bounded publication is not a defect          | `validate-authorized-publication` |
| Held-out audit phrasing                                  | `ab-audit-paraphrase`             |
| Ordinary repository guidance                             | `non-skill-guidance`              |
| Manifest-only packaging                                  | `ab-plugin-packaging`             |
| Running an existing suite                                | `ab-run-existing-suite`           |
| Implement an audit finding on an existing draft          | `implement-audit-finding`         |

Prepared target skills use `SKILL.draft.md` so they cannot compete with the
installed audit skill. Audit cases leave checked-in files unchanged and never
perform the target skill's external action. The implementation case checks the
new boundary: a follow-up fix is ordinary engineering work, not an audit or
new skill creation.
