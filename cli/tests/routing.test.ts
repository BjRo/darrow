import { describe, expect, test } from "bun:test";
import { amendRouteModel } from "../src/routing";
import type { ExecutionRoute } from "../src/types";

const fixedRoute: ExecutionRoute = {
  routeId: `sha256:${"a".repeat(64)}`,
  profileId: "codex",
  profileDigest: `sha256:${"b".repeat(64)}`,
  harness: "codex",
  provider: "openai",
  model: "gpt-5.6-sol",
  reasoningEffort: "high",
  permissions: { inherit: true },
  limits: {},
  adapter: { id: "codex-cli", version: "0.1.0" },
  selectionSource: "fixed_plan",
};

describe("M2b fixed execution routes", () => {
  test("a model amendment creates a scoped effective route without mutating the plan route", () => {
    const amended = amendRouteModel(fixedRoute, "openai/future model");

    expect(amended).toMatchObject({
      model: "openai/future model",
      selectionSource: "scoped_human_amendment",
      profileId: fixedRoute.profileId,
      profileDigest: fixedRoute.profileDigest,
      harness: fixedRoute.harness,
      provider: fixedRoute.provider,
      reasoningEffort: fixedRoute.reasoningEffort,
      permissions: fixedRoute.permissions,
      limits: fixedRoute.limits,
      adapter: fixedRoute.adapter,
    });
    expect(amended.routeId).toBe(
      `${fixedRoute.routeId}:model:openai%2Ffuture%20model`,
    );
    expect(fixedRoute.model).toBe("gpt-5.6-sol");
    expect(fixedRoute.selectionSource).toBe("fixed_plan");
  });
});
