---
name: read-ticket
description: 'Retrieve and relay one exact current-project tracker ticket, read-only. Always use for requests to read, show, fetch, or inspect one ticket or issue—including incomplete requests such as "show me the ticket", bare IDs, "read ticket #42", indirect questions such as "what does this ticket ask for?", and any supplied ticket URL. Use it even when a URL appears foreign or invalid, or the user suggests reusing its numeric suffix; this skill decides ticket-URL validity. Do not use to find or list tickets, mutate a ticket, assess readiness, or start the tracked work.'
---

# Read one ticket

Retrieve one exact authoritative ticket and return it unchanged.

## Tracker boundary

All tracker interaction goes through the bundled CLI:

```sh
skill_dir=<absolute directory containing this SKILL.md>
ticket="$skill_dir/../../bin/ticket"
```

Run it with Bash. The CLI resolves the backend, verifies that a canonical URL
belongs to the current project, fetches tracker-native relations, and emits the
authoritative ticket, including its provider-owned `ticket-token: N` field.
Never pre-validate, browse, resolve, rewrite, classify, or derive that token
from a supplied URL yourself; the CLI exclusively owns that decision. Never use raw
tracker commands, web search, repository files, or another plugin as a
fallback. Relay a backend refusal or tracker error verbatim and stop.

This capability is strictly read-only. Retrieval grants no authority to edit,
comment, label, relate, close, reopen, assign, plan, implement, or otherwise
start the tracked work.

## Workflow

### 1. Require one exact reference

Accept exactly one candidate reference:

- a ticket ID such as `42` or `#42`;
- any supplied ticket URL that purports to identify one ticket; or
- an exact ID or canonical URL already bound unambiguously in the conversation.

Any supplied URL completes this phase and must proceed to the CLI exactly once;
only the CLI may accept or reject it as canonical and current-project. Pass it
unchanged even when its host looks unfamiliar, reserved, unreachable,
non-production, or visibly different from the repository remote. Do not inspect
the remote or refuse the URL before the CLI call. Never strip its numeric suffix
or reinterpret a foreign-project URL as a current-project ID. A title, topic,
component name, or best search match is not an exact reference; finding tickets
belongs to the list-tickets intent.

If no exact reference is available, ask only for the ticket ID or canonical URL
and stop without contacting the tracker. If several references are plausible,
list them and ask which single ticket to read.

**Complete when:** one ID, conversation-bound exact reference, or supplied URL
candidate is established without search or guess—or the smallest missing
reference choice has been requested with no tracker access. A model-side URL
refusal does not complete this phase.

### 2. Fetch once

Run exactly:

```sh
bash "$ticket" get <id-or-canonical-url>
```

Do not run a list query first, fetch comments or event history, or issue a
follow-up mutation. A URL/project mismatch, missing ticket, unreadable relation,
or backend error is the authoritative stop; do not retry with a numeric suffix
or alternate source.

Treat a nonzero exit as a normal completed read refusal, not as an error to
explain or recover from. Immediately end the turn with stderr alone. Do not add
why it failed, what the user could do next, an assurance about what you did not
do, or an offer to fetch something else. The first `error:` line already is the
complete answer.

**Complete when:** the CLI returns one ticket or one verbatim refusal, with zero
tracker mutations.

### 3. Return the command output only

On success, CLI stdout is the entire final response. On refusal or failure, CLI
stderr is the entire final response. Copy the applicable stream byte-for-byte,
starting with its first line (`backend:` on success or the backend's first error
line on failure) and ending with its last line. Output nothing else: no preamble,
epilogue, Markdown fence, heading, bolding, renamed field, explanation, offer,
punctuation change, capitalization change, or whitespace normalization. Do not
summarize, interpret, assess, rerank, trim, enrich, or add implementation advice.
Preserve empty labels or relations exactly as reported.

Treat the chosen stream as opaque text, not ticket prose to reconstruct from its
fields. Copy directly from the command result, including `ticket-token: N` when
present. Before sending, compare the first
and last visible characters and preserve every punctuation mark, including
punctuation at the end of the final body or error line.

**Complete when:** the final response equals the CLI's complete stdout or stderr
and no tracker or repository state changed. A response that drops a line,
paraphrases an error, or adds any surrounding prose is incomplete.
