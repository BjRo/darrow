import { runLegacyAblation } from "../sevro-extension/legacy-ablation";

if (import.meta.main)
  process.exitCode = await runLegacyAblation(Bun.argv.slice(2));
