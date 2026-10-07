import { homedir } from "node:os";
import { join } from "node:path";
import { optionValue } from "./suite-routes";

const nativeOptions = new Set([
  "--codex-bin",
  "--codex-auth-file",
  "--claude-bin",
  "--claude-credential-file",
  "--claude-uv-cache-dir",
  "--claude-project-settings",
  "--toolchain-bin-dir",
  "--config-root",
  "--run-state-root",
  "--protected-root",
  "--jobs",
  "--shell-isolation",
]);
const claudeOptions = new Set([
  "--claude-bin",
  "--claude-credential-file",
  "--claude-uv-cache-dir",
  "--claude-project-settings",
]);

function nativeOption(
  args: string[],
  index: number,
  owned: string[],
  label: string,
) {
  const token = args[index]!;
  const name = token.split("=", 1)[0]!;
  if (!nativeOptions.has(name) || owned.includes(name))
    throw new Error(`${label} option cannot be forwarded: ${name}`);
  const takesValue = ![
    "--shell-isolation",
    "--claude-project-settings",
  ].includes(name);
  if (!takesValue || token.includes("="))
    return { name, args: [token], next: index + 1 };
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--"))
    throw new Error(`Missing value for ${name}`);
  return { name, args: [token, value], next: index + 2 };
}

function nativeArguments(
  args: string[],
  host: string,
  owned: string[],
  label: string,
) {
  const result: string[] = [];
  for (let index = 0; index < args.length;) {
    const option = nativeOption(args, index, owned, label);
    if (host === "claude" || !claudeOptions.has(option.name))
      result.push(...option.args);
    index = option.next;
  }
  return result;
}

function binary(name: string) {
  const path = Bun.which(name);
  if (!path) throw new Error(`${name} command is unavailable`);
  return path;
}

/** Bind native tooling defaults while keeping each caller's owned options separate. */
export function callerHostOptions(
  forwarded: string[],
  host: string,
  owned: string[] = [],
  label = "Benchmark",
) {
  const args = nativeArguments(forwarded, host, owned, label);
  const defaults: Array<[string, () => string]> = [
    ["--codex-bin", () => binary("codex")],
    [
      "--codex-auth-file",
      () =>
        join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
    ],
    ...(host === "claude"
      ? [["--claude-bin", () => binary("claude")] as [string, () => string]]
      : []),
  ];
  for (const [name, value] of defaults)
    if (optionValue(args, name) === null) args.push(name, value());
  if (host === "claude" && !args.includes("--claude-project-settings"))
    args.push("--claude-project-settings");
  if (!args.includes("--shell-isolation")) args.push("--shell-isolation");
  return args;
}
