import { resolve } from "node:path";
import { prepareRepositoryRuntime } from "./sevro-extension/uv-seed-cache";

prepareRepositoryRuntime(resolve(import.meta.dir, ".."));
