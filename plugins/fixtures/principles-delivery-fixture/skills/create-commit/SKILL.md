---
name: create-commit
description: "Fixture-only: Create one authorized Conventional Commit for selected local fixture changes after the caller supplies current verification and independent review evidence. Refuse unrelated files, missing authority or failed checks. Use only in isolated Principles delivery evals; exclude ordinary engineering."
---

# Commit the selected local change

This is a narrow Git test double. Require explicit commit authority and the caller's passed current-candidate checks and actual independent review. Confirm the intended files are only config.json and any focused acceptance-test changes. Run fixture-commit '<imperative Conventional Commit message>' <selected-path> ... with exactly those paths. Return the full commit and absolute repository evidence unchanged. Refuse unrelated paths or failed checks. Do not amend, rewrite, push, publish, skip hooks, attribute AI authorship or bypass any refusal. The same owner retains the verification, repair and completion contract.
