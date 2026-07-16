import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  assertCurrentRequest,
  createHumanRequest,
  readHumanInstructions,
  selectedChoice,
  storeHumanInstructions,
} from "../src/human";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

function request() {
  return createHumanRequest({
    requestId: "implement-model-unavailable-1",
    version: 1,
    stepId: "implement",
    reason: "model_unavailable",
    question: "Retry the step?",
    choices: [
      {
        id: "retry",
        consequence: "Run another attempt.",
        acceptsInstructions: true,
      },
      {
        id: "abort",
        consequence: "Cancel the run.",
        acceptsInstructions: false,
      },
    ],
  });
}

test("human request correlation rejects stale and disallowed responses", () => {
  const current = request();
  expect(assertCurrentRequest(current, current.requestId, 1)).toBe(current);
  expect(() => assertCurrentRequest(current, current.requestId, 2)).toThrow(
    "stale continuation",
  );
  expect(selectedChoice(current, "retry").acceptsInstructions).toBe(true);
  expect(() => selectedChoice(current, "waive")).toThrow(
    "continuation requires one of",
  );
});

test("human instructions are immutable, referenced, and verified", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "darrow-human-"));
  temps.push(root);
  const runDir = resolve(root, ".darrow", "runs", "run-1");
  await mkdir(runDir, { recursive: true });
  const current = request();
  const first = await storeHumanInstructions(
    root,
    runDir,
    current,
    "Keep the existing API.\n",
  );
  expect(first).not.toBeNull();
  expect(
    await storeHumanInstructions(
      root,
      runDir,
      current,
      "Keep the existing API.\n",
    ),
  ).toEqual(first);
  expect(
    storeHumanInstructions(root, runDir, current, "Change the API.\n"),
  ).rejects.toThrow("immutable human response content");
  expect(await readHumanInstructions(root, runDir, first!)).toBe(
    "Keep the existing API.\n",
  );
  await expect(
    readHumanInstructions(root, runDir, {
      ...first!,
      location: "outside.txt",
    }),
  ).rejects.toThrow("escapes its run");
});
