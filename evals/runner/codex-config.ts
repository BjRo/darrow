import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "smol-toml";

const repositoryConfig = resolve(import.meta.dir, "../../.codex/config.toml");
let capturedConcurrency: number | null | undefined;

function readConfiguration(configPath: string): Record<string, unknown> | null {
  let source: string;
  try {
    source = readFileSync(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`Cannot read Codex eval configuration: ${configPath}`, {
      cause: error,
    });
  }
  try {
    return parse(source, { integersAsBigInt: true });
  } catch (error) {
    throw new Error(`Invalid Codex eval configuration: ${configPath}`, {
      cause: error,
    });
  }
}

/** Import only the explicit repository setting, never the user's config. */
export function readCodexAgentConcurrency(configPath: string): number | null {
  const config = readConfiguration(configPath);
  if (config === null) return null;
  const agents = config.agents;
  if (agents === undefined) return null;
  if (!agents || typeof agents !== "object" || Array.isArray(agents)) {
    throw new Error(`Expected an agents table in ${configPath}`);
  }
  const limit = (agents as Record<string, unknown>)
    .max_concurrent_threads_per_session;
  if (limit === undefined) return null;
  if (
    typeof limit !== "bigint" ||
    limit < 1n ||
    limit > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error(
      `Expected a positive integer for agents.max_concurrent_threads_per_session in ${configPath}`,
    );
  }
  return Number(limit);
}

/** Keep a run's identity and all of its isolated processes on one value. */
export function codexAgentConcurrency(): number | null {
  if (capturedConcurrency === undefined) {
    capturedConcurrency = readCodexAgentConcurrency(repositoryConfig);
  }
  return capturedConcurrency;
}

export function codexAgentConcurrencyEvidence(harness: string): {
  codexAgentConcurrencyLimit?: number | null;
} {
  return harness === "codex"
    ? { codexAgentConcurrencyLimit: codexAgentConcurrency() }
    : {};
}
