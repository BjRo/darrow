import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildNativeReviewProof } from "./native-review-proof";

const entry = (ordinal: number, payload: Record<string, unknown>) =>
  JSON.stringify({
    timestamp: `2026-08-18T10:58:${String(ordinal).padStart(2, "0")}.000Z`,
    ordinal,
    type: payload.type === "item_completed" ? "event_msg" : "response_item",
    payload,
  });

function launchEntries(callId: string, taskName: string, ordinal: number) {
  const childId = `/root/${taskName}`;
  return [
    entry(ordinal, {
      type: "function_call",
      name: "spawn_agent",
      namespace: "collaboration",
      call_id: callId,
      arguments: JSON.stringify({
        task_name: taskName,
        fork_turns: "none",
        model: "gpt-5.6-sol",
        reasoning_effort: "xhigh",
        message: "encrypted",
      }),
    }),
    entry(ordinal + 1, {
      type: "item_completed",
      item: {
        type: "SubAgentActivity",
        id: callId,
        kind: "started",
        agent_thread_id: `thread-${taskName}`,
        agent_path: childId,
      },
    }),
    entry(ordinal + 2, {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify({ task_name: childId }),
    }),
  ];
}

async function fixture(root: string) {
  const paths = {
    session: join(root, "session.jsonl"),
    scope: join(root, "scope.json"),
    routeRecord: join(root, "route.json"),
    standardsRecord: join(root, "standards.json"),
    specRecord: join(root, "spec.json"),
  };
  await writeFile(
    paths.scope,
    JSON.stringify({ target: "WORKTREE@abc+def", scope_checksum: "def" }),
  );
  await writeFile(
    paths.routeRecord,
    JSON.stringify({
      selected_route: {
        host: "codex",
        provider: "openai",
        model: "gpt-5.6-sol",
        effort: "xhigh",
      },
      route_source: "bundled",
    }),
  );
  for (const axis of ["standards", "spec"]) {
    await writeFile(
      paths[axis === "standards" ? "standardsRecord" : "specRecord"],
      JSON.stringify({
        selected_route: {
          host: "codex",
          provider: "openai",
          model: "gpt-5.6-sol",
          effort: "xhigh",
        },
        requested_route: {
          host: "codex",
          provider: "openai",
          model: "gpt-5.6-sol",
          effort: "xhigh",
        },
        route_applied_by: "native-subagent",
        route_bound: "true",
        axis,
        agent_id: `/root/proof_${axis}`,
      }),
    );
  }
  return paths;
}

describe("native review proof", () => {
  test("joins route records to two accepted native starts before the first wait", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-native-proof-"));
    try {
      const paths = await fixture(root);
      await writeFile(
        paths.session,
        [
          ...launchEntries("call-standards", "proof_standards", 1),
          ...launchEntries("call-spec", "proof_spec", 4),
          entry(7, {
            type: "function_call",
            name: "wait_agent",
            namespace: "collaboration",
            call_id: "call-wait",
            arguments: "{}",
          }),
        ].join("\n"),
      );
      const proof = await buildNativeReviewProof({
        ...paths,
        standardsCall: "call-standards",
        specCall: "call-spec",
      });
      expect(proof.outcome).toBe("pass");
      expect(proof.launches.map((launch) => launch.childId)).toEqual([
        "/root/proof_standards",
        "/root/proof_spec",
      ]);
      expect(proof.checks).toEqual({
        distinctChildren: true,
        axisMarkedTaskNames: true,
        bothNativeStartsObserved: true,
        bothAcceptedBeforeFirstWait: true,
        exactRetainedLaunchBatch: true,
        applicationRecordsBound: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a coordinator-authored binding record without a native start", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-native-proof-"));
    try {
      const paths = await fixture(root);
      await writeFile(
        paths.session,
        [
          ...launchEntries("call-standards", "proof_standards", 1),
          ...launchEntries("call-spec", "proof_spec", 4).filter(
            (line) => !line.includes("SubAgentActivity"),
          ),
          entry(7, {
            type: "function_call",
            name: "wait_agent",
            namespace: "collaboration",
            call_id: "call-wait",
          }),
        ].join("\n"),
      );
      await expect(
        buildNativeReviewProof({
          ...paths,
          standardsCall: "call-standards",
          specCall: "call-spec",
        }),
      ).rejects.toThrow("expected one spec native start, found 0");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a native task name without the bound axis marker", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-native-proof-"));
    try {
      const paths = await fixture(root);
      await writeFile(
        paths.specRecord,
        (await Bun.file(paths.specRecord).text()).replace(
          "/root/proof_spec",
          "/root/proof_reader",
        ),
      );
      await writeFile(
        paths.session,
        [
          ...launchEntries("call-standards", "proof_standards", 1),
          ...launchEntries("call-spec", "proof_reader", 4),
          entry(7, {
            type: "function_call",
            name: "wait_agent",
            namespace: "collaboration",
            call_id: "call-wait",
          }),
        ].join("\n"),
      );
      await expect(
        buildNativeReviewProof({
          ...paths,
          standardsCall: "call-standards",
          specCall: "call-spec",
        }),
      ).rejects.toThrow("spec spawn request does not match its bound route");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a native task name containing both axis markers", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-native-proof-"));
    try {
      const paths = await fixture(root);
      await writeFile(
        paths.standardsRecord,
        (await Bun.file(paths.standardsRecord).text()).replace(
          "/root/proof_standards",
          "/root/proof_standards_spec",
        ),
      );
      await writeFile(
        paths.session,
        [
          ...launchEntries("call-standards", "proof_standards_spec", 1),
          ...launchEntries("call-spec", "proof_spec", 4),
          entry(7, {
            type: "function_call",
            name: "wait_agent",
            namespace: "collaboration",
            call_id: "call-wait",
          }),
        ].join("\n"),
      );
      await expect(
        buildNativeReviewProof({
          ...paths,
          standardsCall: "call-standards",
          specCall: "call-spec",
        }),
      ).rejects.toThrow(
        "standards spawn request does not match its bound route",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects an additional retained spawn in the native launch batch", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-native-proof-"));
    try {
      const paths = await fixture(root);
      await writeFile(
        paths.session,
        [
          entry(1, {
            type: "function_call",
            name: "spawn_agent",
            namespace: "collaboration",
            call_id: "call-extra",
            arguments: "{}",
          }),
          ...launchEntries("call-standards", "proof_standards", 2),
          ...launchEntries("call-spec", "proof_spec", 5),
          entry(8, {
            type: "function_call",
            name: "wait_agent",
            namespace: "collaboration",
            call_id: "call-wait",
          }),
        ].join("\n"),
      );
      await expect(
        buildNativeReviewProof({
          ...paths,
          standardsCall: "call-standards",
          specCall: "call-spec",
        }),
      ).rejects.toThrow(
        "native launch batch contains 3 spawn requests; expected exactly two bound readers",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a native start observed after its accepted output", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-native-proof-"));
    try {
      const paths = await fixture(root);
      const spec = launchEntries("call-spec", "proof_spec", 4).map(
        (line, index) => {
          if (index !== 1) return line;
          const value = JSON.parse(line) as Record<string, unknown>;
          value.ordinal = 7;
          return JSON.stringify(value);
        },
      );
      await writeFile(
        paths.session,
        [
          ...launchEntries("call-standards", "proof_standards", 1),
          ...spec,
          entry(8, {
            type: "function_call",
            name: "wait_agent",
            namespace: "collaboration",
            call_id: "call-wait",
          }),
        ].join("\n"),
      );
      await expect(
        buildNativeReviewProof({
          ...paths,
          standardsCall: "call-standards",
          specCall: "call-spec",
        }),
      ).rejects.toThrow("spec native launch events are out of order");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a non-OpenAI provider before joining Codex records", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-native-proof-"));
    try {
      const paths = await fixture(root);
      for (const path of [
        paths.routeRecord,
        paths.standardsRecord,
        paths.specRecord,
      ]) {
        await writeFile(
          path,
          (await Bun.file(path).text()).replaceAll("openai", "anthropic"),
        );
      }
      await writeFile(
        paths.session,
        [
          ...launchEntries("call-standards", "proof_standards", 1),
          ...launchEntries("call-spec", "proof_spec", 4),
          entry(7, {
            type: "function_call",
            name: "wait_agent",
            namespace: "collaboration",
            call_id: "call-wait",
          }),
        ].join("\n"),
      );
      await expect(
        buildNativeReviewProof({
          ...paths,
          standardsCall: "call-standards",
          specCall: "call-spec",
        }),
      ).rejects.toThrow("native Codex proof requires the OpenAI provider");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
