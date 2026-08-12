---
name: grilling
description: Grill, interview, challenge, or relentlessly stress-test a plan, decision, design, or idea through dependency-aware question rounds with recommendations. Use when the user explicitly asks to be grilled, interviewed, challenged, stress-tested, or wants rigorous questioning before acting, and when an enclosing skill explicitly requests structured grilling. Do not use merely because an ordinary implementation or deliverable request is incomplete or needs one clarification.
---

# Grilling

## Missing-subject gate

Apply this gate as the first behavior after loading this skill, before following
any other section or inspecting the repository for subject facts. If the user
explicitly requests grilling but their message does not identify a plan,
decision, design, idea, or other subject to grill, make the user-facing final
answer exactly this line:

```text
What subject would you like me to grill?
```

Stop the skill immediately after that answer. Any other content in the final
answer violates this capability, including a greeting, explanation, topic menu,
example, second question, numbered frontier, Markdown wrapper, or paraphrase.
Do not infer a subject from unrelated repository content.

Reach shared understanding without silently filling gaps. Treat an identified
subject as a dependency-aware decision tree, investigate available facts
yourself, and leave product decisions and consequential choices with the user.

This capability is conversational and read-only. Do not write or edit files,
record decisions, create or update tickets, start another workflow, implement,
commit, or publish. An enclosing capability retains its own output and
authority boundaries; grilling adds none.

## The method is part of the request

“Grilling” means dependency-aware frontier rounds, agent-owned fact finding,
one recommendation with each material question, and no assumed user answers.
These are the capability's defining behavior, not optional presentation
preferences.

Before numbering any question, apply this test: can you truthfully recommend
one concrete answer to a choice the user has authority to make? If not, the
node is not ready for the numbered frontier. Investigate it, report the exact
missing evidence or access outside the numbered questions, or defer it. Never
emit an empty recommendation, “Recommendation: none,” or an equivalent
placeholder.

If a request also says to ask every downstream question immediately, omit
recommendations, or assume missing answers, briefly explain that those
instructions conflict with grilling and then follow this method. Do not turn
the session into a generic questionnaire. If the user actually wants a
different activity, they can withdraw the grilling request.

A short named subject such as “customer-controlled data residency” is enough
to begin. Its missing detail is what the decision tree will resolve. Do not ask
for a fuller proposal, document, or questionnaire before constructing the
first frontier unless the message contains no identifiable subject at all.

## 1. Establish the subject

Identify the plan, decision, design, idea, or enclosing outcome to examine.
Carry forward choices the user has already made and sources they identified as
authoritative.

If the subject is missing, respond only with `What subject would you like me to
grill?` and stop the round. Do not guess a topic, add any other text, or
manufacture a questionnaire from unrelated repository content.

State the working subject briefly when its boundary could otherwise be
misunderstood. Do not ask the user to repeat context that is already available.

## 2. Build the decision tree

Map the material decisions and the prerequisites between them. A decision is
settled only by an explicit user choice or confirmation, an authoritative
source that determines it, or a fact you have actually established.

Classify every open node before asking about it:

- **discoverable fact** — inspect the current repository or available external
  evidence yourself;
- **confirmation** — present what the evidence establishes and ask whether the
  user intends a permitted override or additional constraint; or
- **human decision** — ask because evidence cannot choose intent, approve a
  trade-off, or supply missing authority.

Investigate only facts that can change the current tree or make a frontier
question concrete. Prefer repository evidence and authoritative primary
sources. Cite or point to the evidence compactly. If a required fact cannot be
established, expose the exact evidence gap rather than converting it into a
user decision or assumption.

Keep unavailable facts outside the numbered decision frontier. Report the
missing source or access needed and defer only the branches that depend on it;
do not disguise an evidence request as a user decision with “Recommendation:
none.” Every numbered frontier question must be a real choice and carry an
actual recommended answer.

Evidence may constrain choices but does not silently decide product intent.

## 3. Ask the current frontier

The frontier is every unresolved human decision whose prerequisites are now
settled. Ask all material, independent frontier questions in the current
round. Defer a question when its choices or useful wording depend on an answer
still open in this round.

Deferred means absent from the numbered round, not included with an “after Q1”
or “once this is settled” preface. You may state the dependency compactly
outside the questions. For example, if selecting a storage vendor depends on
the allowed regions, ask only for the allowed regions now; do not ask for the
vendor or vendor-selection criteria until that answer is settled.

For each question:

1. number it;
2. give it a short title;
3. explain the decision and concrete options at the user's altitude;
4. state one recommended answer; and
5. explain the recommendation using current evidence and trade-offs.

Use this shape unless the host surface makes it inaccessible:

```text
Q1 — <short title>: <question and concrete choices>

Recommendation: <recommended answer and why>
```

Keep the round focused. Do not ask hypothetical downstream questions merely
to appear exhaustive. Do not hide several independent decisions inside one
question, and do not omit recommendations because the user requested only a
question list. Recommendations are advisory and never count as accepted
answers.

After asking the round, wait for the user's answers. Do not answer on their
behalf, continue into dependent branches, or produce a final artifact in the
same turn.

## 4. Recompute after every answer

Apply the user's answers to the tree and preserve their meaning. An answer may
settle a node, expose a new branch, make an earlier question irrelevant, or
turn a suspected decision into a discoverable fact.

Investigate newly unblocked facts, recompute the frontier, and ask the next
round. If an answer is internally contradictory or leaves a material choice
ambiguous, ask the smallest follow-up required before advancing its dependent
branches.

Keep visible any explicit assumptions, intentionally deferred questions, and
unavailable evidence. Do not equate “not important now” with a permanent
decision unless the user establishes that boundary.

## 5. Confirm closure

When no material decision or required fact remains unresolved, summarize:

- the decisions reached;
- the evidence and constraints that shaped them;
- explicit assumptions and intentionally deferred questions; and
- one sentence restating the resulting shared understanding.

Ask the user to confirm or correct that one-sentence restatement. The grilling
session is complete only after explicit confirmation. An empty current round,
a recommendation the user has not accepted, or a plausible default is not
closure.

After confirmation, report that the conversation reached shared understanding
and stop. Standalone grilling does not act on, persist, plan, or implement the
result. When an enclosing capability requested grilling, return the confirmed
decisions, evidence, assumptions, and deferred questions to that capability
without claiming its separate outcome is complete.
