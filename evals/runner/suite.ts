import { runSevroBenchmarkSuite } from "../sevro-extension/benchmark-suite";

process.exit(await runSevroBenchmarkSuite(Bun.argv.slice(2)));
