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

Keep useful internals and unique examples. Do not replace local safety guidance
with generic boilerplate or copy every manifest field into central pages.
Increment both manifest versions together for each changed plugin.

## Deterministic local checks

Run `bun run check:docs`. It checks Markdown links and heading anchors,
image alternatives, fenced-code languages, required plugin README sections,
marketplace/catalog/manifests, and exact guide-entrypoint synchronization.
It also checks inventory-to-case coverage and the inventory's source and static
destinations, and verifies that plugin skill directories are readable.
Checks use a Markdown parser and GitHub heading slugs; code examples are not
treated as live links. Repository-only guide cases and inactive eval fixtures
are kept distinct. A local check needs no network connection.

Run `bun run check:docs:external` separately. It retries transient network
failures twice and reports the affected URL and referring page. A permanent
HTTP error needs a corrected destination; rate limits, authentication walls,
timeouts, and bot blocks need human triage and a later retry. Do not suppress
local failures or rewrite a working link merely to make a network job green.
External link checks do not establish that a source's claims are correct.

## Human review rubric

- Can a new reader reach first success, selection, architecture, troubleshooting,
  and contributing from the landing page without guessing?
- Does each page answer one reader need in plain language, with short paragraphs
  and terms defined or linked in the glossary?
- Does it lead with the result or next action, use active voice, and avoid
  repeated points or unnecessary process narration?
- Do headings form a meaningful hierarchy, without skipped levels or labels
  that make sense only in context?
- Do links describe their destination when read alone? Avoid “click here”.
- Do tables remain readable on a narrow screen? Avoid wide prose catalogs.
- Does the source order make sense to a screen reader, including diagrams and
  their explanations? Does every complex diagram have a short alternative and
  adjacent or linked text communicating the same relationships?
- Are distinctions conveyed in words or structure, without relying on color?
- Are code fences labelled, commands copy/paste-safe, and shell commands clearly
  separate from commands typed inside an agent session?
- Are prerequisites, expected results, verification limits, recovery paths,
  mutation effects, and the actual supported hosts explicit?
- Did contraction preserve authoritative rules and unique safety knowledge,
  with question mappings and passing cross-host evidence for each removal?
- When detail is long, is the outcome easy to find without hiding or dropping
  the complete evidence?

The [layer explanation](choosing-plugins.md#understand-the-layers) supplies the
long description for the landing-page diagram. Preserve its SVG title and
description metadata as well as its image alternative.

This rubric follows W3C guidance on
[complex image alternatives](https://www.w3.org/WAI/tutorials/images/complex/),
[meaningful headings and labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html),
and [unusual words](https://www.w3.org/WAI/WCAG22/Understanding/unusual-words.html).
Automated checks are evidence for the mechanical rules, not an accessibility audit.
