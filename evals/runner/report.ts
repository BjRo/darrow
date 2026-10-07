import { runLegacyReport } from "../sevro-extension/legacy-report";

process.exitCode = await runLegacyReport(Bun.argv.slice(2), {
  defaultMarkdownOutput: true,
});
