import { mkdir, readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runSevroGuide } from "./sevro-extension/guide";

// Sequential single-trial invocations make the documented first-failure stop real.
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
