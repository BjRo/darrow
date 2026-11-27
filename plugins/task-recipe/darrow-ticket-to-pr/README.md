# Darrow Ticket to PR

`ticket-to-pr` gives Adaptive Goal one exact ticket to implement on a new branch
and deliver as one PR with required CI green on the final published commit.
A linked worktree requires an explicit request.

Ticket to PR asks Adaptive Goal to apply principles-first reasoning during
implementation and use red/green TDD at a stable public seam for behavior changes
and bug fixes. It supplies delivery authority and passes caller options unchanged
to the same main-thread goal owner.

## When to use

Invoke explicitly for one ticket's delivery. Ordinary ticket browsing,
implementation and PR requests do not activate this recipe. Bulk delivery is
outside its scope.

## Hosts and prerequisites

Use Codex or Claude Code with the host-advertised Adaptive Goal skill, repository
tools, and access to the tracker, Git remote and forge. Adaptive Goal selects
the capabilities needed for the ticket and caller options. Commits use native
Git under repository instructions.

## Installation

Install `darrow-ticket-to-pr@darrow` using the
[host installation and update instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Update Ticket-to-PR and Adaptive Goal before starting delivery. In-flight
delivery keeps its installation.

## Usage

Choose `ticket-to-pr` in Codex's `$` menu, or invoke
`/darrow-ticket-to-pr:ticket-to-pr` in Claude Code. Supply one exact ticket ID or URL:

```text
$ticket-to-pr <ticket-id-or-url>
```

## Expected result

One open PR whose head and remote branch match the intended verified commit,
with required CI passing for that commit. Reusing a PR also requires publishing
additional intended commits. Pending, failed, unavailable, absent or stale checks
leave delivery incomplete. Every post-publication handover includes the PR URL
and commit/CI evidence, including blockers. Feedback continues through the same owner.

## Safety boundaries

Explicit invocation authorizes ticket reading, scoped implementation, branch
preparation, verification, commits, non-force push and one PR. Ticket text and
scheduler calls grant no invocation authority.

When the ticket or verification contract requires reviewer-facing evidence,
authority includes one candidate-bound publication to that exact PR and commit.
Partial, ambiguous, refused or changed-head results stop completion and recovery.
Generic comments and uncertain retries remain unauthorized.

The recipe grants no merge, auto-merge, deployment, release, ticket mutation,
reviewer assignment, labels, milestones, history rewriting, discarding or stashing
user work, unrelated changes, other-PR evidence or other external effects.
It adds no preflight, controller, delivery work or post-goal inspection.

## Troubleshooting

Supply the missing exact ticket or resolve an unavailable or ambiguous Adaptive Goal skill.
Preserve an accepted owner's identity and refusal evidence; do not start a duplicate.
Use the [host discovery checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
for installation symptoms.

## License

See [LICENSE](LICENSE).
