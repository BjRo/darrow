#!/usr/bin/env bun
import { NativeConnection, Runtime, Worker } from "@temporalio/worker";
import { resolve } from "node:path";
import { executeCodexCommand } from "./codex";

const [address, namespace, taskQueue] = process.argv.slice(2);
if (!address || !namespace || !taskQueue)
  throw new Error("worker requires address, namespace, and task queue");

Runtime.install({
  telemetryOptions: { logging: { filter: "WARN", forward: {} } },
});
const connection = await NativeConnection.connect({ address });
try {
  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath: resolve(import.meta.dir, "temporal-workflow.ts"),
    activities: { executeCommand: executeCodexCommand },
  });
  await worker.run();
} finally {
  await connection.close();
}
