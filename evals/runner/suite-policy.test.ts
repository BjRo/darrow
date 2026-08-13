import { describe, expect, test } from "bun:test";
import { hasGatingCellFailure } from "./suite-policy";

describe("evaluation suite gate policy", () => {
  test("ignores failed comparative cells when the candidate gate passes", () => {
    expect(
      hasGatingCellFailure([
        { gating: true, exitCode: 0 },
        { gating: false, exitCode: 1 },
      ]),
    ).toBe(false);
  });

  test("fails when a gating cell fails", () => {
    expect(
      hasGatingCellFailure([
        { gating: true, exitCode: 1 },
        { gating: false, exitCode: 0 },
      ]),
    ).toBe(true);
  });
});
