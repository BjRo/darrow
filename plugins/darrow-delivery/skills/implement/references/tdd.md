# Behavioral TDD

Use one vertical slice at a time: one observable behavior, one focused failing
test, the smallest implementation that makes it pass, then the relevant
regression suite.

## Choose the seam

- Prefer a public API, command, rendered output, persisted result, or other seam
  a caller can observe.
- Avoid asserting private call order, internal helper structure, or the exact
  implementation strategy.
- Use real internal collaborators. Mock only external boundaries such as
  network services, clocks, randomness, or expensive system integrations.

## State the expectation independently

Use a literal or independently derived expected outcome. Do not compute the
expected value by repeating the implementation's algorithm or by calling the
code under test.

## Establish meaningful red

Run the focused test before changing production code and inspect its output.
The failure is meaningful only when it shows the requested behavior is absent.
Missing tools, dependencies, fixtures, unrelated compilation failures, and
generic nonzero exits are setup failures. Repair the test setup without
installing dependencies, or stop if no meaningful red can be established.

Keep the focused command unchanged for green. Refactor only after green, and
only when it helps the requested change without broadening its scope.
