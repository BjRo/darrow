#!/usr/bin/env bun
import { isAbsolute, resolve } from "node:path";
import { parseArgs } from "node:util";
import { auditCaseCompatibility } from "./index";

const repositoryRoot = resolve(import.meta.dir, "../..");

if (import.meta.main) {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        "project-root": { type: "string", default: repositoryRoot },
        json: { type: "boolean", default: false },
        "allow-unsupported": { type: "boolean", default: false },
      },
      strict: true,
    });
    const root = values["project-root"]!;
    if (!isAbsolute(root)) throw new Error("project root must be absolute");
    const report = await auditCaseCompatibility(root);
    process.stdout.write(
      values.json
        ? `${JSON.stringify(report, null, 2)}\n`
        : [
            `${report.supported}/${report.total} Darrow cases resolve through Sevro`,
            ...report.failures.map(
              ({ id, source, error }) =>
                `${source}: ${id ?? "<missing id>"}: ${error}`,
            ),
            "",
          ].join("\n"),
    );
    if (!report.valid && !values["allow-unsupported"]) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 64;
  }
}
