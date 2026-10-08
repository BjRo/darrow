import { runLegacyCompare } from "../sevro-extension/legacy-compare";

process.exitCode = await runLegacyCompare(process.argv.slice(2));
