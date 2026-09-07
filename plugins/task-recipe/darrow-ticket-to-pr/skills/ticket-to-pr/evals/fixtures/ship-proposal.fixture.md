---
name: ship-proposal
description: Publish committed branch content through one new or explicitly reused pull request, returning verified repository, branch, base, draft and commit evidence. Use when an authorized delivery needs a PR or must publish additional commits to its existing PR.
---

# Ship one proposal

Inputs: explicit non-force publication and reuse authority, current feature
branch, and the intended full commit ID. This fixture supports only the existing
open proposal on `fix/GH-42-timeout` into `main`, ready for review.

Run `ship-proposal <intended-full-commit-id>` after the caller's final checks.
The operation publishes without rewriting history, then returns repository,
URL, head/base, draft and independently observed remote/forge commit evidence.
Return all evidence unchanged. On refusal, stop the operation and return the
refusal to the caller, who owns continuation. It never authorizes committing,
metadata edits, merge, ticket mutation or another proposal.
