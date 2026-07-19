import { describe, expect, test } from "bun:test";
import { assertObservationIdentity } from "../src/runner";
import type { Assignment } from "../src/types";

const assignment: Assignment = {
  ordinal: 1,
  taskId: "task-1",
  repository: "repo-1",
  phase: "smoke",
  stratum: "simple",
  harness: "codex",
  treatment: "cli",
  repeat: 1,
  order: 1,
};

const identity = {
  assignment,
  runnerRevision: "runner-1",
  pluginDigest: "plugin-1",
  configurationDigest: "config-1",
  harnessVersion: "harness-1",
  sourceRevision: "source-1",
  model: "model-1",
  effort: "medium",
  permissionMode: "full",
};

describe("observation checkpoint identity", () => {
  test("accepts an exact evaluation identity", () => {
    expect(() =>
      assertObservationIdentity(identity, identity, "/tmp/observation.json"),
    ).not.toThrow();
  });

  test("refuses stale checkpoints with an actionable fresh-root message", () => {
    expect(() =>
      assertObservationIdentity(
        { ...identity, configurationDigest: "old-config" },
        identity,
        "/tmp/observation.json",
      ),
    ).toThrow(
      "existing observation does not match the current evaluation identity (configurationDigest): /tmp/observation.json; use a fresh --results root",
    );
  });

  test("includes every mismatched identity field in the refusal", () => {
    expect(() =>
      assertObservationIdentity(
        {
          ...identity,
          assignment: { ...assignment, treatment: "plugins" },
          pluginDigest: "old-plugin",
          model: "old-model",
        },
        identity,
        "/tmp/observation.json",
      ),
    ).toThrow(/assignment, pluginDigest, model/);
  });
});
