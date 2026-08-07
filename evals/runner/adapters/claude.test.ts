import { describe, expect, test } from "bun:test";
import { claudeAdapter, claudeInputTokens, claudeRunSucceeded } from "./claude";

test("uses Sonnet 5 as the default Claude eval model", () => {
  expect(claudeAdapter.defaultModel).toBe("claude-sonnet-5");
});

describe("Claude token accounting", () => {
  test("includes uncached, cache-creation, and cache-read input", () => {
    expect(
      claudeInputTokens({
        input_tokens: 7,
        cache_creation_input_tokens: 11_933,
        cache_read_input_tokens: 99_129,
      }),
    ).toBe(111_069);
  });

  test("treats omitted usage buckets as zero", () => {
    expect(claudeInputTokens({ input_tokens: 12 })).toBe(12);
    expect(claudeInputTokens(undefined)).toBe(0);
  });
});

describe("Claude terminal result state", () => {
  test("accepts a successful non-error result", () => {
    expect(claudeRunSucceeded(0, { subtype: "success", is_error: false })).toBe(
      true,
    );
  });

  test("rejects API errors even when Claude labels the subtype success", () => {
    expect(claudeRunSucceeded(0, { subtype: "success", is_error: true })).toBe(
      false,
    );
    expect(claudeRunSucceeded(1, { subtype: "success", is_error: false })).toBe(
      false,
    );
  });
});
