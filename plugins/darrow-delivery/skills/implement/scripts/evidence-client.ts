#!/usr/bin/env bun
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const directory = process.env.DARROW_EVIDENCE_BROKER_DIR;
const token = process.env.DARROW_EVIDENCE_BROKER_TOKEN;
if (!directory || !token) throw new Error("Darrow evidence broker is unavailable");

const args = process.argv.slice(2);
const operation = args.shift();
let payload: Record<string, unknown>;
if (operation === "validate") {
  if (args.length !== 1) throw new Error("usage: evidence.sh validate <dir>");
  payload = { operation };
} else if (operation === "run") {
  if (args.length < 3) throw new Error("usage: evidence.sh run <dir> <phase> [--expected text] -- <command> [args...]");
  args.shift();
  const phase = args.shift();
  let expected = "";
  if (args[0] === "--expected") { args.shift(); expected = args.shift() ?? ""; }
  if (args.shift() !== "--" || args.length === 0) throw new Error("phase command must follow --");
  payload = { operation, phase, expected, command: args };
} else throw new Error("usage: evidence.sh {run|validate} ...");

const id = crypto.randomUUID();
const request = resolve(directory, `${id}.request.json`);
const response = resolve(directory, `${id}.response.json`);
await Bun.write(request, `${JSON.stringify({ token, ...payload })}\n`);
for (let attempt = 0; attempt < 1_080_000 && !await Bun.file(response).exists(); attempt += 1) await Bun.sleep(20);
if (!await Bun.file(response).exists()) throw new Error("Darrow evidence broker timed out");
const result = await Bun.file(response).json() as { exitCode?: number; stdout?: string; stderr?: string; error?: string };
await rm(request, { force: true });
await rm(response, { force: true });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) console.error(`error: ${result.error}`);
process.exit(result.exitCode ?? (result.error ? 2 : 0));
