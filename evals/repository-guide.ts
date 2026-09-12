import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { CaseResult } from "./runner/types";

// Sequential single-trial invocations make the documented first-failure stop real.
const root = resolve(import.meta.dir, "..");
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    only: { type: "string", multiple: true },
    harness: { type: "string" },
    dry: { type: "boolean", default: false },
    "without-skill": { type: "boolean", default: false },
  },
});
const inventory = JSON.parse(
  await readFile(
    join(root, ".agents/skills/darrow-guide/evals/inventory.json"),
    "utf8",
  ),
) as {
  version: number;
  questions: Array<{ id: string }>;
};
const hosts = values.harness ? [values.harness] : ["codex", "claude"];
if (hosts.some((host) => !["codex", "claude"].includes(host)))
  throw new Error("--harness must be codex or claude");
for (const id of values.only ?? []) {
  if (!inventory.questions.some((question) => question.id === id))
    throw new Error(`Unknown question: ${id}`);
}
const questions = inventory.questions.filter(
  (question) => !values.only || values.only.includes(question.id),
);
const output = join(
  root,
  "evals/results",
  `guide-v${inventory.version}`,
  new Date().toISOString().replace(/[:.]/g, "-"),
);
await mkdir(output, { recursive: true });
console.log(`Guide evidence: ${output}`);
for (const question of questions) {
  for (const host of hosts) {
    const destination = join(output, `${question.id}-${host}.json`);
    const command = [
      process.execPath,
      join(root, "evals/runner/run.ts"),
      "--skill",
      "darrow-guide",
      "--case",
      question.id,
      "--harness",
      host,
      "--trials",
      "1",
      "--jobs",
      "1",
      "--threshold",
      "1",
      "--semantic-check-model",
      "gpt-5.6-terra",
      "--semantic-check-effort",
      "medium",
      "--output",
      destination,
      ...(values.dry ? ["--dry"] : []),
      ...(values["without-skill"] ? ["--without-skill"] : []),
    ];
    const child = Bun.spawn(command, {
      cwd: root,
      stdout: "inherit",
      stderr: "inherit",
    });
    const stop = () => child.kill("SIGTERM");
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    const code = await child.exited;
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    if (code !== 0) process.exit(code);
    const results = JSON.parse(
      await readFile(destination, "utf8"),
    ) as CaseResult[];
    if (results.length !== 1 || results[0]?.caseId !== question.id)
      throw new Error(`Case selection was not exact for ${question.id}`);
    if (
      !values.dry &&
      (results[0].executionMode !== "executed" ||
        results[0].passRate !== 1 ||
        (!values["without-skill"] && results[0].activationPassRate !== 1))
    )
      throw new Error(
        `Guide case failed; inspect ${destination} before continuing`,
      );
  }
}
