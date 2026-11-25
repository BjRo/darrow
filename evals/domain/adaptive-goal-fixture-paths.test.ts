import { expect, test } from "bun:test";

const fixtures = new URL(
  "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/fixtures/",
  import.meta.url,
);

for (const fixture of [
  "independent-review/SKILL.fixture.md",
  "implementation-readiness/SKILL.fixture.md",
  "owner-readiness.fixture.md",
  "verification/SKILL.fixture.md",
]) {
  test(`${fixture} avoids parent traversal in helper commands`, async () => {
    const instructions = await Bun.file(new URL(fixture, fixtures)).text();
    const commands =
      instructions.match(/uv run[^\r\n]*adaptive-goal-fixture[^\r\n]*/g) ?? [];
    expect(commands.length).toBeGreaterThan(0);
    const unsafeCommands = commands.filter((command) =>
      command.includes("/../"),
    );
    expect(unsafeCommands).toEqual([]);
  });
}
