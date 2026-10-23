import { expect } from "bun:test";
import { copyFile, mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { captureTestCommand } from "../test-command";

// Exercise the standalone historical command, including its file and exit contract.
export async function historicalReviewProofCommand(
  script: URL,
  args: string[],
  output: string,
): Promise<string> {
  const consumer = join(dirname(output), "standalone-command");
  await mkdir(consumer);
  const executable = join(consumer, basename(fileURLToPath(script)));
  await copyFile(script, executable);
  if (basename(executable) === "legacy-native-review-proof.ts")
    await copyFile(
      new URL("./review-axis.ts", script),
      join(consumer, "review-axis.ts"),
    );
  const { exitCode, stdout, stderr } = await captureTestCommand(
    [process.execPath, executable, ...args, "--output", output],
    undefined,
    { cwd: consumer, env: process.env },
  );
  if (exitCode !== 0) {
    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(await Bun.file(output).exists()).toBe(false);
    throw new Error(stderr);
  }
  expect(stderr).toBe("");
  expect(stdout).toBe(`${output}\n`);
  return Bun.file(output).text();
}
