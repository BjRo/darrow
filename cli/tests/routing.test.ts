import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { prepareRouteAmendment } from "../src/amendments";
import { routeForProfile } from "../src/compiler";
import { validRouteAmendment } from "../src/routing";
import type {
  HumanRequest,
  ResolvedPlan,
  ResolvedProfile,
  RunRecord,
} from "../src/types";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

const fixedProfile: ResolvedProfile = {
  schemaVersion: "0.1.0",
  id: "codex",
  harness: "codex",
  provider: "openai",
  model: "gpt-5.6-sol",
  reasoningEffort: "high",
  permissions: { inherit: true },
  source: "/profiles/codex.yaml",
  scope: "bundled",
  digest: `sha256:${"a".repeat(64)}`,
};
const fixedRoute = routeForProfile(fixedProfile);
const plan = {
  schemaVersion: "0.1.0",
  engineVersion: "0.1.0",
  workflow: {
    id: "test",
    version: "0.1.0",
    source: "/workflow.yaml",
    scope: "project",
    digest: `sha256:${"b".repeat(64)}`,
  },
  roles: [{ id: "implement", profile: fixedProfile }],
  capabilities: [],
  loops: [],
  steps: [
    {
      id: "implement",
      dependsOn: [],
      commandId: "darrow-delivery:implement",
      contractVersion: "0.1.0",
      cancellation: "wait_for_boundary",
      role: "implement",
      route: fixedRoute,
      source: "/command",
      digest: `sha256:${"c".repeat(64)}`,
      input: {},
      publish: null,
    },
  ],
  inputs: {},
  digest: `sha256:${"d".repeat(64)}`,
} satisfies ResolvedPlan;
const request: HumanRequest = {
  requestId: "implement-model-unavailable-1",
  version: 1,
  stepId: "implement",
  reason: "model_unavailable",
  question: "Select another route?",
  choices: [
    {
      id: "amend",
      consequence: "Use another profile.",
      acceptsInstructions: true,
    },
  ],
  context: [],
};

function runRecord(): RunRecord {
  return {
    schemaVersion: "0.1.0",
    runId: "run-1",
    workflowId: "test",
    state: "waiting_for_input",
    conclusion: null,
    createdAt: "2026-07-18T10:00:00.000Z",
    updatedAt: "2026-07-18T10:00:00.000Z",
    temporal: {},
    workspace: "/workspace",
    currentStep: "implement",
    steps: [{ stepId: "implement", state: "waiting_for_input", attempt: 1 }],
    request,
    waivers: [],
    amendments: [],
    cancellation: null,
    error: { category: "model_unavailable", message: "unavailable" },
  };
}

async function profileRoot(profile: string): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), "darrow-amendment-"));
  temps.push(root);
  await mkdir(resolve(root, ".darrow", "profiles"), { recursive: true });
  await writeFile(
    resolve(
      root,
      ".darrow",
      "profiles",
      `${/^id: ([^\n]+)/m.exec(profile)![1]}.yaml`,
    ),
    profile,
  );
  return root;
}

describe("M2b scoped route amendments", () => {
  test("resolves a complete replacement profile for only the target step's remaining attempts", async () => {
    const root = await profileRoot(`schemaVersion: 0.1.0
id: codex-recovery
harness: codex
provider: openai
model: gpt-5.5-codex
reasoningEffort: medium
permissions:
  inherit: true
`);
    const amendment = await prepareRouteAmendment({
      repoRoot: root,
      plan,
      record: runRecord(),
      request,
      profileId: "codex-recovery",
      responseId: "response-1",
      actor: { id: "user-1", harness: "codex", verified: false },
      approvedAt: "2026-07-18T10:01:00.000Z",
    });

    expect(validRouteAmendment(amendment)).toBe(true);
    expect(amendment).toMatchObject({
      stepId: "implement",
      planRouteId: fixedRoute.routeId,
      attemptScope: { fromAttempt: 2, throughAttempt: null },
      unavailableRoute: fixedRoute,
      replacementProfile: {
        id: "codex-recovery",
        scope: "project",
        model: "gpt-5.5-codex",
        reasoningEffort: "medium",
      },
      replacementRoute: {
        profileId: "codex-recovery",
        harness: "codex",
        provider: "openai",
        model: "gpt-5.5-codex",
        reasoningEffort: "medium",
        permissions: { inherit: true },
        limits: {},
        adapter: { id: "codex-cli", version: "0.1.0" },
        selectionSource: "scoped_human_amendment",
      },
    });
    expect(plan.steps[0]!.route).toEqual(fixedRoute);
    expect(plan.steps[0]!.route.selectionSource).toBe("fixed_plan");
  });

  test("rejects a replacement whose harness was not preflighted for the step", async () => {
    const root = await profileRoot(`schemaVersion: 0.1.0
id: claude-recovery
harness: claude
provider: anthropic
model: claude-sonnet-4-6
reasoningEffort: high
permissions:
  inherit: true
`);
    await expect(
      prepareRouteAmendment({
        repoRoot: root,
        plan,
        record: runRecord(),
        request,
        profileId: "claude-recovery",
        responseId: "response-2",
        actor: { id: null, harness: null, verified: false },
        approvedAt: "2026-07-18T10:01:00.000Z",
      }),
    ).rejects.toThrow("was preflighted for codex");
  });

  test("rejects incomplete or internally inconsistent amendment payloads", async () => {
    expect(
      validRouteAmendment({
        amendmentId: `sha256:${"e".repeat(64)}`,
        requestId: request.requestId,
        responseId: "response-3",
        stepId: "implement",
        planRouteId: fixedRoute.routeId,
        attemptScope: { fromAttempt: 2, throughAttempt: null },
        unavailableRoute: fixedRoute,
        replacementProfile: fixedProfile,
        replacementRoute: { ...fixedRoute, model: "different" },
        actor: { id: null, harness: null, verified: false },
        approvedAt: "2026-07-18T10:01:00.000Z",
      }),
    ).toBe(false);
  });
});
