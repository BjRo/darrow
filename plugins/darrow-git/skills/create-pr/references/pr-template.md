# Fill a pull request template

Use the repository template as the PR body's exact structure. It replaces the
default why/what shape.

1. If inspection says the template was truncated, read the absolute template
   path it reports before drafting.
2. Keep every template heading verbatim and in its original order.
3. Follow instructions inside HTML comments, then remove all HTML comments
   from the proposed body.
4. Fill every section with branch-specific evidence from the commits,
   diffstat, conversation, or verified test state. Remove placeholder text.
5. Preserve every template checklist item. Check only statements known to be
   true for this branch; leave the others unchecked.
6. Include a known ticket identifier verbatim in the section requested by the
   template, or in the most relevant contextual section.
7. Pass each heading together with its filled content as one `-b` section, in
   template order.

Do not author or edit the repository template as part of creating the PR.

**Complete when:** every original heading and checklist item is present, every
section contains real content, every comment and placeholder is gone, and the
body states only claims supported by available evidence.
