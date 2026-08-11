# Native Ticket-to-PR Draft PR Experiment

Status: live feasibility experiment, not an accepted decision or product eval  
Reviewed: 2026-08-11  
Artifact: the draft pull request containing this note

## Purpose

This experiment tests the publication slice of the adaptive ticket-to-PR
hypothesis against the real Darrow repository and GitHub remote. One
host-native goal receives an explicitly authorized pull-request outcome and
uses Darrow's intent-matched Git capabilities to create a branch, commit one
harmless research artifact, push, and open exactly one draft pull request.

The experiment is deliberately smaller than a complete ticket implementation.
It tests whether native goal ownership and capability composition can cross the
external publication boundary without a Darrow phase controller.

## Goal and authority

```text
Outcome:
  One real draft pull request exists against Darrow's default branch and
  contains this experiment record.

Authorized effects:
  - create one conventional experiment branch from the current clean main;
  - add this research artifact;
  - run repository formatting and validation;
  - create one intended Conventional Commit;
  - push the experiment branch without force; and
  - open exactly one draft pull request.

Not authorized:
  - modify unrelated product or plugin behavior;
  - update tickets or existing pull requests;
  - add reviewers, labels, or milestones;
  - merge the pull request;
  - release or deploy; or
  - delete remote state after the experiment.
```

## Pass criteria

The publication slice passes only when current repository and GitHub evidence
proves all of the following:

1. The experiment starts from a clean `main` checkout.
2. `create-branch` creates one conventional branch from `main`.
3. The committed delta contains this research artifact and no unrelated work.
4. Repository formatting and applicable validation pass before commit.
5. `create-commit` creates one new Conventional Commit without bypassing hooks.
6. `create-pr` pushes without force and opens one new draft pull request against
   `main`.
7. The returned PR scope matches the experiment branch and commit.
8. No ticket, merge, release, deployment, reviewer, label, or milestone state
   is changed.

Any missing capability, authentication failure, duplicate PR, hook failure,
scope mismatch, or non-draft result is a blocked or failed experiment rather
than evidence of success.

## Evidence to retain

The containing PR and its Git history are the authoritative artifacts. The
terminal report should record:

- branch and base;
- commit hash and subject;
- formatting and validation commands;
- draft PR URL;
- committed file scope;
- any local changes excluded from the PR; and
- any degraded or unverified condition.

Host telemetry may additionally record the active goal, capability calls,
selected and effective route, wall time, tokens, and interruptions. Those
operational records are useful for later comparisons but are not reconstructed
inside this repository note.

## Limitations

One successful draft PR does not establish the complete ticket-to-PR design or
the proposed 90% coverage. This experiment does not test:

- ticket-provider discovery;
- implementation-readiness or quality-bar assessment;
- product implementation and test-first feedback;
- risk classification or fresh-context review;
- evidence capture beyond this Markdown artifact;
- recovery from partial state or interruption;
- capability absence and refusal paths;
- Claude and Codex parity; or
- repeated trials, comparative quality, cost, or latency.

Those concerns require matched fixtures and multiple trials after this live
publication slice proves feasible.
