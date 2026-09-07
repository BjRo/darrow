import { expect, test } from "bun:test";
import {
  effectiveNativeOwnerRoute,
  effectiveOwnerRouteCheck,
} from "./owner-evidence";

const receipt = {
  type: "darrow.codex_native_single_agent_accepted",
  agent_ref: "/root/owner",
  model: "gpt-5.6-terra",
  reasoning_effort: "medium",
  fork_turns: "none",
  role: "unverified",
};
const expected = { model: "gpt-5.6-terra", effort: "medium" };

test("native acceptance proves only the effective route", () => {
  const raw = JSON.stringify(receipt);
  expect(effectiveNativeOwnerRoute(raw)).toEqual({
    harness: "codex",
    provider: "openai",
    ...expected,
  });
  expect(effectiveOwnerRouteCheck(raw, expected).passed).toBe(true);
  expect(
    effectiveOwnerRouteCheck(raw, { ...expected, model: "gpt-5.6-luna" })
      .passed,
  ).toBe(false);
});

test("missing, duplicate, malformed and inherited routes remain unverified", () => {
  for (const raw of [
    "",
    "malformed",
    "null",
    "[]",
    JSON.stringify({ type: "darrow.codex_native_spawn" }),
    JSON.stringify(receipt) + "\n" + JSON.stringify(receipt),
    JSON.stringify(receipt) +
      '\n{"type":"darrow.codex_native_session_malformed"}',
    JSON.stringify({ ...receipt, fork_turns: "all" }),
    JSON.stringify({ ...receipt, reasoning_effort: "invalid" }),
  ])
    expect(effectiveOwnerRouteCheck(raw, expected).passed).toBe(false);
});
