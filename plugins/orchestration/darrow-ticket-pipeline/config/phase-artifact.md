# Phase artifact contract

Write one artifact to the absolute output path in the phase packet. Do not
write it into the repository and do not update the tracker yourself.

Use exactly seven TSV header records, the delimiter, then Markdown evidence:

```text
format\tdarrow-ticket-pipeline-phase-v1
run_id\t<RUN_ID>
phase\t<PHASE>
iteration\t<ITERATION>
agent\t<AGENT_ID>
status\t<STATUS>
summary\t<ONE LINE WITHOUT TAB OR PIPE>
---
<MARKDOWN EVIDENCE>
```

Copy run ID, phase, iteration, and agent ID exactly from the packet. Keep the
summary non-empty, at most 500 characters, and free of tabs, newlines, and `|`.
Do not add header fields or move the delimiter.

Allowed statuses:

| Phase     | Statuses                                                  |
| --------- | --------------------------------------------------------- |
| refine    | `complete`, `needs_human`, `blocked`                      |
| challenge | `approved`, `needs_revision`, `needs_human`, `blocked`    |
| implement | `complete`, `failed`, `needs_human`, `blocked`            |
| review    | `approved`, `changes_requested`, `needs_human`, `blocked` |
| rework    | `complete`, `failed`, `needs_human`, `blocked`            |
| qa        | `passed`, `failed`, `needs_human`, `blocked`              |
| codify    | `complete`, `no_change`, `needs_human`, `blocked`         |

Use `blocked` for unavailable required tools, unreadable applicable guidance,
or an environment that prevents required proof. Use `needs_human` only for a
material product, safety, or authority decision. Never convert missing
evidence into success.

The Markdown is the durable ticket artifact. Include exact paths, commands,
and observed results. Do not include hidden reasoning, a conversation
transcript, credentials, environment values, broad source excerpts, or any
heading beginning `## Ticket Pipeline`; those headings are reserved for the
controller-owned ticket schema.
