---
name: independent-code-review
description: Independently review one exact current code change and report its findings and outcome. Use when an explicit goal contract requires independent review before completion or publication. Remain read-only and do not repair, commit, push, publish, approve, merge, release, or deploy.
---

# Independently review the current change

Resolve this file's directory and the repository root, then run exactly:

```sh
bash "$skill_dir/../../bin/independent-review-fixture" "$repo"
```

Treat the ordinary prose response as this capability's complete, read-only
review. Return it to an enclosing goal when the goal contract requested the
review. Do not repair the change or perform the enclosing goal's next action
inside this capability.
