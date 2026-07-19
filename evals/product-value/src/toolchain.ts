import { resolve } from "node:path";
import type { Protocol } from "./types";
import { REPO_ROOT } from "./config";

export async function temporalExecutable(protocol: Protocol): Promise<string> {
  const toolchainHome = resolve(REPO_ROOT, protocol.paths.toolchainHome);
  const temporalGlob = new Bun.Glob("temporal/1.8.0/*/temporal");
  for await (const rel of temporalGlob.scan(toolchainHome))
    return resolve(toolchainHome, rel);
  throw new Error(
    "pinned Temporal 1.8.0 is unavailable; run `bun evals/product-value/cli.ts install-toolchain`",
  );
}
