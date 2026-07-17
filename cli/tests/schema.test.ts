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
  ["ticket.json", "ticket-publication.schema.json"],
  ["cleanup.json", "cleanup.schema.json"],
];

describe("0.1.0 contract fixtures", () => {
  for (const [fixture, schema] of fixtures) {
    test(`${fixture} satisfies ${schema}`, async () => {
      const path = resolve(CLI_ROOT, "fixtures", "golden", fixture);
      const value = fixture.endsWith(".yaml")
        ? parse(await Bun.file(path).text())
        : await readJson(path);
      await expect(
        validateSchema(schema, value, fixture),
      ).resolves.toBeUndefined();
    });
  }

  test("strict schemas reject unknown top-level fields", async () => {
    const value = {
      ...(await readJson<Record<string, unknown>>(
        resolve(CLI_ROOT, "fixtures", "golden", "engine.json"),
      )),
      unexpected: true,
    };
    await expect(
      validateSchema("engine.schema.json", value, "engine"),
    ).rejects.toThrow("additional properties");
  });

  test("strict lock schema rejects unknown nested fields", async () => {
    const value = await readJson<Record<string, any>>(
      resolve(CLI_ROOT, "fixtures", "golden", "lock.json"),
    );
    value.adapter.unexpected = true;
    await expect(
      validateSchema("lock.schema.json", value, "lock"),
    ).rejects.toThrow("additional properties");
  });

  test("protocol schema discriminates command payloads", async () => {
    const emptyInit = {
      protocolVersion: "0.1.0",
      command: "init",
      ok: true,
      data: {},
      error: null,
    };
    await expect(
      validateSchema("protocol.schema.json", emptyInit, "protocol"),
    ).rejects.toThrow("required property");
    const mixedInit = {
      protocolVersion: "0.1.0",
      command: "init",
      ok: true,
      data: {
        repository: "/repo",
        stateDirectory: "/repo/.darrow",
        runId: "run-1",
      },
      error: null,
    };
    await expect(
      validateSchema("protocol.schema.json", mixedInit, "protocol"),
    ).rejects.toThrow("additional properties");
    const contradictory = {
      protocolVersion: "0.1.0",
      command: "run",
      ok: true,
      data: {
        runId: "run-1",
        state: "completed",
        conclusion: "failed",
        workspace: "/repo",
        results: [],
      },
      error: null,
    };
    await expect(
      validateSchema("protocol.schema.json", contradictory, "protocol"),
    ).rejects.toThrow("must match exactly one schema");
  });

  test("waiting protocol exposes a correlated human request", async () => {
    const waiting = {
      protocolVersion: "0.1.0",
      command: "run",
      ok: true,
      data: {
        runId: "run-1",
        state: "waiting_for_input",
        request: {
          requestId: "implement-model-unavailable-1",
          version: 1,
          stepId: "implement",
          reason: "model_unavailable",
          question: "Retry the implementation?",
          choices: [
            {
              id: "retry",
              consequence: "Run another attempt.",
              acceptsInstructions: true,
            },
          ],
          context: [],
        },
        continuation: "darrow continue run-1",
      },
      error: null,
    };
    await expect(
      validateSchema("protocol.schema.json", waiting, "waiting protocol"),
    ).resolves.toBeUndefined();
    await expect(
      validateSchema(
        "protocol.schema.json",
        {
          ...waiting,
          data: {
            ...waiting.data,
            request: { ...waiting.data.request, version: 0 },
          },
        },
        "stale waiting protocol",
      ),
    ).rejects.toThrow("must be >= 1");
  });

  test("human response events contain references instead of raw instructions", async () => {
    const received = {
      schemaVersion: "0.1.0",
      eventId: "event-response",
      runId: "run-1",
      timestamp: "2026-07-16T20:00:00.000Z",
      type: "human.input.received",
      data: {
        requestId: "implement-model-unavailable-1",
        version: 1,
        choice: "retry",
        actor: { id: "user-1", harness: "codex", verified: false },
        instructions: {
          contentId: "human-response-1",
          mediaType: "text/plain",
          contentHash: `sha256:${"a".repeat(64)}`,
          size: 12,
          location: ".darrow/runs/run-1/content/human/response.txt",
        },
        rationale: null,
      },
    };
    await expect(
      validateSchema("event.schema.json", received, "human response"),
    ).resolves.toBeUndefined();
    await expect(
      validateSchema(
        "event.schema.json",
        {
          ...received,
          data: { ...received.data, content: "raw instructions" },
        },
        "human response",
      ),
    ).rejects.toThrow("additional properties");
  });

  test("workflow loop bounds and waiver records are strict", async () => {
    const workflow = parse(
      await Bun.file(
        resolve(CLI_ROOT, "fixtures", "golden", "workflow.yaml"),
      ).text(),
    );
    workflow.loops = [
      {
        id: "implementation-review",
        steps: ["implement"],
        maxAttempts: 0,
        until: { stepId: "implement", output: "summary", equals: "approved" },
        waiver: null,
      },
    ];
    await expect(
      validateSchema("workflow.schema.json", workflow, "bounded workflow"),
    ).rejects.toThrow("must be >= 1");

    const waiver = {
      schemaVersion: "0.1.0",
      eventId: "event-waiver",
      runId: "run-1",
      timestamp: "2026-07-16T20:00:00.000Z",
      type: "waiver.accepted",
      data: {
        waiverId: "review-rejection-1",
        loopId: "implementation-review",
        stepId: "review",
        attempt: 1,
        outcome: { output: "approved", expected: true, actual: false },
        actor: { id: "user-1", harness: "codex", verified: false },
        rationale: {
          contentId: "waiver-rationale",
          mediaType: "text/plain",
          contentHash: `sha256:${"b".repeat(64)}`,
          size: 18,
          location: ".darrow/runs/run-1/content/human/rationale.txt",
        },
        instructions: null,
        instructionsTo: null,
      },
    };
    await expect(
      validateSchema("event.schema.json", waiver, "waiver event"),
    ).resolves.toBeUndefined();
  });

  test("recovery event records the authoritative reconciliation mode", async () => {
    const recovered = {
      schemaVersion: "0.1.0",
      eventId: "event-recovered",
      runId: "run-1",
      timestamp: "2026-07-16T20:00:00.000Z",
      type: "run.recovered",
      data: {
        mode: "started_pending",
        workflowId: "workflow-1",
        workspace: "/repo/.darrow/worktrees/run-1",
      },
    };
    await expect(
      validateSchema("event.schema.json", recovered, "recovery event"),
    ).resolves.toBeUndefined();
    await expect(
      validateSchema(
        "event.schema.json",
        { ...recovered, data: { ...recovered.data, mode: "reconstructed" } },
        "recovery event",
      ),
    ).rejects.toThrow("allowed values");
  });

  test("cancellation contracts reject unsafe or incomplete records", async () => {
    const requested = {
      schemaVersion: "0.1.0",
      eventId: "event-cancel",
      runId: "run-1",
      timestamp: "2026-07-16T20:00:00.000Z",
      type: "run.cancel.requested",
      data: { requestedAt: "2026-07-16T20:00:00.000Z" },
    };
    await expect(
      validateSchema("event.schema.json", requested, "cancellation request"),
    ).resolves.toBeUndefined();

    const metadata = {
      schemaVersion: 1,
      kind: "command",
      contractVersion: "1.0.0",
      inputSchema: "./input.schema.json",
      outputSchema: "./output.schema.json",
      cancellation: "interrupt",
    };
    await expect(
      validateSchema(
        "skill-metadata.schema.json",
        metadata,
        "command metadata",
      ),
    ).resolves.toBeUndefined();
    await expect(
      validateSchema(
        "skill-metadata.schema.json",
        { ...metadata, cancellation: "kill" },
        "unsafe command metadata",
      ),
    ).rejects.toThrow("allowed values");
  });

  test("cleanup events preserve bounded deletion evidence", async () => {
    const deleted = {
      schemaVersion: "0.1.0",
      eventId: "event-cleanup",
      runId: "run-1",
      timestamp: "2026-07-16T20:00:01.000Z",
      type: "cleanup.resource.deleted",
      data: {
        resourceId: "run-1:artifacts",
        kind: "artifacts",
        path: "/repo/.darrow/runs/run-1/artifacts",
        size: 128,
        completedAt: "2026-07-16T20:00:01.000Z",
      },
    };
    await expect(
      validateSchema("event.schema.json", deleted, "cleanup event"),
    ).resolves.toBeUndefined();
    await expect(
      validateSchema(
        "event.schema.json",
        {
          ...deleted,
          data: {
            ...deleted.data,
            resourceId: `ticket:${"a".repeat(64)}:${"b".repeat(64)}`,
            kind: "ticket_artifact",
            ticketKey: "a".repeat(64),
            publicationId: "b".repeat(64),
          },
        },
        "ticket cleanup event",
      ),
    ).resolves.toBeUndefined();
    await expect(
      validateSchema(
        "event.schema.json",
        { ...deleted, data: { ...deleted.data, body: "raw artifact" } },
        "cleanup event",
      ),
    ).rejects.toThrow("additional properties");
  });

  test("publication events contain bounded ticket and artifact references", async () => {
    const record = await readJson<Record<string, any>>(
      resolve(CLI_ROOT, "fixtures", "golden", "ticket.json"),
    );
    const published = {
      schemaVersion: "0.1.0",
      eventId: "event-publication",
      runId: "run-1",
      timestamp: "2026-07-17T10:00:01.000Z",
      type: "ticket.artifacts.published",
      data: {
        ticketKey: record.ticketKey,
        ticket: record.ticket,
        artifacts: record.publications,
      },
    };
    await expect(
      validateSchema("event.schema.json", published, "publication event"),
    ).resolves.toBeUndefined();
    await expect(
      validateSchema(
        "event.schema.json",
        {
          ...published,
          data: { ...published.data, body: "published artifact content" },
        },
        "publication event with body",
      ),
    ).rejects.toThrow("additional properties");
  });
});
