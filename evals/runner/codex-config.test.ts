import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCodexAgentConcurrency } from "./codex-config";

const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function configFile(source?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "darrow-codex-config-"));
  temporary.push(root);
  const path = join(root, "config.toml");
  if (source !== undefined) await writeFile(path, source);
  return path;
}

test("reads the explicit limit without importing unrelated configuration", async () => {
  const path = await configFile(
    'model = "unrelated"\n[features]\nplugin_hooks = true\n[agents]\nmax_concurrent_threads_per_session = 7\n',
  );
  expect(readCodexAgentConcurrency(path)).toBe(7);
});

test("absent configuration or an absent limit uses the host default", async () => {
  for (const source of [undefined, "", "[agents]\nenabled = true\n"]) {
    expect(readCodexAgentConcurrency(await configFile(source))).toBeNull();
  }
});

test.each(["0", "-1", "1.5", "5.0", '"5"', "true", "9007199254740992"])(
  "rejects an invalid explicit limit (%s) instead of using a default",
  async (value) => {
    const path = await configFile(
      `[agents]\nmax_concurrent_threads_per_session = ${value}\n`,
    );
    expect(() => readCodexAgentConcurrency(path)).toThrow("positive integer");
    expect(() => readCodexAgentConcurrency(path)).toThrow(path);
  },
);

test("rejects malformed TOML and a non-table agents value", async () => {
  const malformed = await configFile("[agents");
  expect(() => readCodexAgentConcurrency(malformed)).toThrow(
    `Invalid Codex eval configuration: ${malformed}`,
  );
  const wrongTable = await configFile("agents = 5");
  expect(() => readCodexAgentConcurrency(wrongTable)).toThrow(
    `Expected an agents table in ${wrongTable}`,
  );
});

test("does not treat configuration I/O errors as a missing file", async () => {
  const path = await configFile();
  await mkdir(path);
  expect(() => readCodexAgentConcurrency(path)).toThrow(
    `Cannot read Codex eval configuration: ${path}`,
  );
});
