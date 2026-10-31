import { cp, lstat } from "node:fs/promises";
import { join } from "node:path";

// Trusted no-model adapter: copy public build dependencies, then let Sevro's
// credential-free shell grader execute candidate code under its usual isolation.
export default {
  id: "darrow.host.ci-fixture",
  model: "no-model",
  effort: "none",
  async run(request: { workspace: string; prompt: string }) {
    const source = JSON.parse(request.prompt).source as string;
    for (const path of [
      "node_modules",
      ".git/eval-venv",
      ".git/eval-tools",
      ".git/fixture-tools",
      ".git/eval-tsconfig.json",
      ".git/eval-stubs.d.ts",
      ".git/fixture-bin/go",
      ".fixture-state/go",
    ]) {
      try {
        await lstat(join(source, path));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      await cp(join(source, path), join(request.workspace, path), {
        recursive: true,
        verbatimSymlinks: true,
      });
    }
    return {
      finalMessage: "Prepared isolated CI check",
      complete: true,
      actualCondition: "passive" as const,
    };
  },
};
