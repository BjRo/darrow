# Review Darrow documentation

Use this contract with the [contributor guidance](../CONTRIBUTING.md). Pages
serve one primary reader need; the static spine must work without the guide.

## Plain-language standard

Lead with the answer, outcome, or next action. Put supporting detail after it.
Use familiar words and active voice. Keep sentences and paragraphs short, and
explain a necessary Darrow term when it first appears.

Remove repetition, throat-clearing, and narration about how the writer reached
the result. Do not remove technical meaning, safety rules, evidence, exact
commands and identifiers, prerequisites, recovery steps, or required protocol
fields. When full evidence is long, summarize the outcome first and retain the
evidence in later sections or link to its readable source.

Historical research and retained eval results are evidence records. Do not
rewrite their observations to match current style. Improve their summaries,
indexes, and links instead.

## Plugin README contract

Keep local behavior and safety knowledge in the plugin. Each README needs a
useful introduction describing what it provides, followed by these sections:

- `When to use`: appropriate work and an adjacent task to avoid.
- `Hosts and prerequisites`: actual runtime support and necessary tools/access.
- `Installation`: local installation/update notes or a precise link to the
  canonical host instructions. A link is not a runtime dependency.
- `Usage`: one ordinary request and explicit host invocation, or a clear
  statement that implicit activation is forbidden for an explicit-only skill.
- `Expected result`: observable outcome and material side effects.
- A safety section: preserve the plugin's existing `Design boundaries`,
  `Design model and boundaries`, `Privacy and security`, or `Safety boundaries`.
- `Troubleshooting`: known symptoms, safe checks, and recovery/escalation.
- `License`: preserve existing licensing text and link to the local license.

Keep useful plugin internals, unique examples, developer test commands, and
actionable compatibility and reliability limits. Preserve local safety
guidance; avoid generic boilerplate and manifest inventories.

Put historical eval results, trial counts, pass rates, comparisons, and
investigation narratives in `docs/research/` or colocated eval/test documentation.
Link to that evidence without repeating it in a README. Put eval-runner
internals in development documentation.

## Deterministic local checks

Run `bun run check:docs` for local documentation and repository-structure
checks. Their implementation lives in `scripts/check-docs.ts`; keep the check
inventory there. Code examples are not live links. This gate needs no network.

Run `bun run check:docs:external` separately. Correct permanent HTTP failures;
triage rate limits, authentication walls, timeouts, and bot blocks before retrying.
Do not suppress
local failures or rewrite a working link merely to make a network job green.
External link checks do not establish that a source's claims are correct.

## Human review rubric

- Can readers reach first success, selection, architecture, troubleshooting,
  and contributing from the landing page without guessing? Does each page serve
  one primary need and follow the plain-language standard above, with terms
  defined or linked in the glossary?
- Do headings form a meaningful hierarchy without skipped levels or labels
  that need extra context? Do links describe their destination without “click
  here”? Are tables readable on narrow screens?
- Are distinctions clear without relying on color? Do complex diagrams have
  useful alternatives and adjacent or linked explanations in source order that
  makes sense to a screen reader?
- Are fenced-code languages labelled, commands copy/paste-safe, and shell
  commands distinguished from commands typed inside an agent session?
- Are prerequisites, supported hosts, expected results, verification limits,
  recovery paths, and mutation effects explicit?
- Did pruning preserve authoritative rules and unique safety knowledge, with
  question mappings and passing cross-host evidence for each removal?
- Is the outcome easy to find, with complete evidence retained or linked?

The [layer explanation](choosing-plugins.md#understand-the-layers) supplies the
landing-page diagram's long description. Preserve its SVG title, description
metadata, and image alternative.

This rubric follows W3C guidance on
[complex image alternatives](https://www.w3.org/WAI/tutorials/images/complex/),
[meaningful headings and labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html),
and [unusual words](https://www.w3.org/WAI/WCAG22/Understanding/unusual-words.html).
Mechanical checks do not establish accessibility.
