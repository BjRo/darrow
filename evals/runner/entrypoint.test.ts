import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  qualifiedSkillEntrypoint,
  renderEntrypointTemplate,
} from "./entrypoint";

const SKILL = resolve(
  import.meta.dir,
  "../../plugins/task_recipe/darrow-ticket-to-pr/skills/ticket-to-pr",
);

describe("evaluation entrypoint adapters", () => {
  test("qualifies one mounted plugin skill for each host", () => {
    expect(qualifiedSkillEntrypoint("claude", SKILL)).toBe(
      "/darrow-ticket-to-pr:ticket-to-pr",
    );
    expect(qualifiedSkillEntrypoint("codex", SKILL)).toBe(
      "$darrow-ticket-to-pr:ticket-to-pr",
    );
  });

  test("substitutes only the declared entrypoint placeholder", () => {
    expect(
      renderEntrypointTemplate(
        "{{entrypoint}} Deliver the authoritative ticket.",
        "$darrow-ticket-to-pr:ticket-to-pr",
      ),
    ).toBe(
      "$darrow-ticket-to-pr:ticket-to-pr Deliver the authoritative ticket.",
    );
  });

  test("rejects a missing adapter instead of leaking a placeholder", () => {
    expect(() =>
      renderEntrypointTemplate("{{entrypoint}} Deliver it.", undefined),
    ).toThrow("entrypoint adapter");
  });

  test("rejects an unused mode adapter", () => {
    expect(() =>
      renderEntrypointTemplate(
        "Discuss the ticket without invoking a recipe.",
        "$darrow-ticket-to-pr:ticket-to-pr",
        true,
      ),
    ).toThrow("no {{entrypoint}} placeholder");
  });
});
