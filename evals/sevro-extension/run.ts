import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { sevroCommand } from "./sevro-command";

const repositoryRoot = resolve(import.meta.dir, "../..");
const extension = join(import.meta.dir, "index.ts");
const sourceFiles = [
  extension,
  join(import.meta.dir, "run.ts"),
  join(import.meta.dir, "sevro-command.ts"),
  join(repositoryRoot, "package.json"),
  join(repositoryRoot, "bun.lock"),
];
const reserved = new Set([
  "--case-id",
  "--case-file",
  "--project-root",
  "--results-root",
  "--extension-command-file",
  "--extension-source-file",
  "--runner-checkout-root",
  "--runner-build-digest",
  "--project-digest",
  "--json",
]);

function validateForwarded(forwarded: string[]): void {
  for (const token of forwarded) {
    if (token === "--" || reserved.has(token.split("=", 1)[0]!))
      throw new Error(`Sevro option is owned by Darrow: ${token}`);
  }
}

/** Bind a selected Darrow case to the public Sevro CLI. */
export function invocation(argv: string[]): {
  command: string[];
  resultsRoot: string;
  commandFile: string;
} {
  const separator = argv.indexOf("--");
  if (separator < 0) throw new Error("separate Sevro run options with --");
  const { values } = parseArgs({
    args: argv.slice(0, separator),
    options: {
      "case-id": { type: "string" },
      "project-root": { type: "string" },
      "results-root": { type: "string" },
    },
    strict: true,
  });
  const caseId = values["case-id"];
  const projectRoot = values["project-root"] ?? repositoryRoot;
  const resultsRoot = values["results-root"];
  if (!caseId || !resultsRoot)
    throw new Error("--case-id and --results-root are required");
  if (!isAbsolute(projectRoot) || !isAbsolute(resultsRoot))
    throw new Error("project and results roots must be absolute");
  const forwarded = argv.slice(separator + 1);
  validateForwarded(forwarded);
  const route = sevroCommand();
  const commandFile = join(resultsRoot, "darrow-extension-command.json");
  return {
    commandFile,
    resultsRoot,
    command: [
      ...route.launch,
      "run",
      "--json",
      ...route.extraArgs,
      "--extension-command-file",
      commandFile,
      ...sourceFiles.flatMap((path) => ["--extension-source-file", path]),
      "--case-id",
      caseId,
      "--project-root",
      projectRoot,
      "--results-root",
      resultsRoot,
      ...forwarded,
    ],
  };
}

if (import.meta.main) {
  try {
    const selected = invocation(process.argv.slice(2));
    await mkdir(selected.resultsRoot, { recursive: true });
    await writeFile(
      selected.commandFile,
      JSON.stringify([process.execPath, extension]),
    );
    const child = Bun.spawn(selected.command, {
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });
    const forwardInterrupt = () => child.kill("SIGINT");
    const forwardTerminate = () => child.kill("SIGTERM");
    process.on("SIGINT", forwardInterrupt);
    process.on("SIGTERM", forwardTerminate);
    process.exitCode = await child.exited;
    process.off("SIGINT", forwardInterrupt);
    process.off("SIGTERM", forwardTerminate);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 64;
  }
}
