# Standalone grilling mode

If the user did not identify any subject, reply with exactly `What subject
would you like me to grill?` and stop. Do not infer a subject from unrelated
repository files.

For a named subject, read the complete [decision frontier method](decision-frontier.md)
before building the decision tree. A short subject is enough to start; its
missing details belong in the tree. Inspect relevant facts yourself and ask
the current human-decision frontier. Do not transform a personal or policy
decision into a feature brief or implementation plan.

When no material decisions or required facts remain, summarize the decisions,
evidence, assumptions, and intentional deferrals. End with a one-sentence
restatement and ask the user to confirm or correct it. After confirmation,
report shared understanding and stop; do not act on the result.

Complete when the user confirms the restatement and the material frontier is
empty.
