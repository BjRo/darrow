import { describe, expect, test } from "bun:test";
import { parse } from "yaml";
import { resolve } from "node:path";
import { readJson } from "../src/io";
import { CLI_ROOT } from "../src/paths";
import { validateSchema } from "../src/schema";

const fixtures: Array<[string, string]> = [
  ["engine.json", "engine.schema.json"],
  ["protocol.json", "protocol.schema.json"],
  ["workflow.yaml", "workflow.schema.json"],
  ["profile.yaml", "profile.schema.json"],
  ["plan.json", "resolved-plan.schema.json"],
  ["lock.json", "lock.schema.json"],
  ["event.json", "event.schema.json"],
  ["artifact.json", "artifact.schema.json"],
];

describe("0.1.0 contract fixtures", () => {
  for (const [fixture, schema] of fixtures) {
    test(`${fixture} satisfies ${schema}`, async () => {
      const path = resolve(CLI_ROOT, "fixtures", "golden", fixture);
      const value = fixture.endsWith(".yaml") ? parse(await Bun.file(path).text()) : await readJson(path);
      await expect(validateSchema(schema, value, fixture)).resolves.toBeUndefined();
    });
  }

  test("strict schemas reject unknown top-level fields", async () => {
    const value = { ...await readJson<Record<string, unknown>>(resolve(CLI_ROOT, "fixtures", "golden", "engine.json")), unexpected: true };
    await expect(validateSchema("engine.schema.json", value, "engine")).rejects.toThrow("additional properties");
  });

  test("strict lock schema rejects unknown nested fields", async () => {
    const value = await readJson<Record<string, any>>(resolve(CLI_ROOT, "fixtures", "golden", "lock.json"));
    value.adapter.unexpected = true;
    await expect(validateSchema("lock.schema.json", value, "lock")).rejects.toThrow("additional properties");
  });

  test("protocol schema discriminates command payloads", async () => {
    const emptyInit = { protocolVersion: "0.1.0", command: "init", ok: true, data: {}, error: null };
    await expect(validateSchema("protocol.schema.json", emptyInit, "protocol")).rejects.toThrow("required property");
    const mixedInit = { protocolVersion: "0.1.0", command: "init", ok: true, data: { repository: "/repo", stateDirectory: "/repo/.darrow", runId: "run-1" }, error: null };
    await expect(validateSchema("protocol.schema.json", mixedInit, "protocol")).rejects.toThrow("additional properties");
    const contradictory = { protocolVersion: "0.1.0", command: "run", ok: true, data: { runId: "run-1", state: "completed", conclusion: "failed", workspace: "/repo", results: [] }, error: null };
    await expect(validateSchema("protocol.schema.json", contradictory, "protocol")).rejects.toThrow("must match exactly one schema");
  });
});
