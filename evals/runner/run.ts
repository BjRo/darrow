import { runSevroDirect } from "../sevro-extension/direct-caller";

process.exit(await runSevroDirect(Bun.argv.slice(2)));
