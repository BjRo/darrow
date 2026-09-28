import { mkdir, readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { CaseResult } from "./runner/types";
import { runSevroGuide } from "./sevro-extension/guide";

// Sequential single-trial invocations make the documented first-failure stop real.
const migration = Boolean(
  process.env.SEVRO_PACKAGE_BIN || process.env.SEVRO_CHECKOUT,
);
const argv = Bun.argv.slice(2);
const separator = argv.indexOf("--");
const { values } = parseArgs({
  args: separator < 0 ? argv : argv.slice(0, separator),
  options: {
    only: { type: "string", multiple: true },
    harness: { type: "string" },
    dry: { type: "boolean", default: false },
    "without-skill": { type: "boolean", default: false },
    "project-root": { type: "string" },
    "results-root": { type: "string" },
  },
});
if (
  !migration &&
  (separator >= 0 ||
    values["project-root"] !== undefined ||
    values["results-root"] !== undefined)
)
  throw new Error(
    "Guide root and forwarded options require an explicit Sevro route",
  );
const root = values["project-root"] ?? resolve(import.meta.dir, "..");
const resultsRoot = values["results-root"] ?? join(root, "evals/results");
if (!isAbsolute(root) || !isAbsolute(resultsRoot))
  throw new Error("Guide project and results roots must be absolute");
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
  resultsRoot,
  `guide-v${inventory.version}`,
  new Date().toISOString().replace(/[:.]/g, "-"),
);
await mkdir(output, { recursive: true });
console.log(`Guide evidence: ${output}`);
if (migration)
  process.exit(
    await runSevroGuide({
      root,
      output,
      questions,
      hosts,
      dry: values.dry!,
      withoutSkill: values["without-skill"]!,
      forwarded: separator < 0 ? [] : argv.slice(separator + 1),
    }),
  );
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
