import { describe, expect, test } from "bun:test";
import { selectCaseIds } from "./case-selection";

describe("case selection", () => {
  const ids = ["representative", "representative-edge", "other"];

  test("keeps substring selection for ad hoc filters", () => {
    expect(selectCaseIds(ids, ["representative"])).toEqual([
      "representative",
      "representative-edge",
    ]);
  });

  test("requires exactly named benchmark cases", () => {
    expect(selectCaseIds(ids, ["representative"], "exact")).toEqual([
      "representative",
    ]);
    expect(() => selectCaseIds(ids, ["missing"], "exact")).toThrow(
      "matched no case",
    );
    expect(() =>
      selectCaseIds(ids, ["representative", "representative"], "exact"),
    ).toThrow("must be unique");
    expect(() =>
      selectCaseIds(
        ["representative", "representative", "other"],
        ["representative"],
        "exact",
      ),
    ).toThrow("must match one case");
  });
});
