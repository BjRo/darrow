import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureProcess } from "./process";

test("finishes after the direct child exits while a descendant holds its pipes", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "darrow-process-capture-"));
  const pidFile = join(fixture, "orphan.pid");
  const proc = Bun.spawn(
    [
      "/bin/sh",
      "-c",
      'sleep 30 & printf "%s\\n" "$!" >"$1"; printf captured; printf warning >&2; exit 0',
      "orphan-pipe-fixture",
      pidFile,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const resultPromise = captureProcess(proc, {
    timeoutMs: 1_000,
    drainTimeoutMs: 25,
  });
  const settled = await Promise.race([
    resultPromise.then((result) => result),
    Bun.sleep(750).then(() => null),
  ]);

  const orphanPid = Number.parseInt(await readFile(pidFile, "utf8"), 10);
  let cleanupError: unknown;
  if (Number.isInteger(orphanPid)) {
    try {
      process.kill(orphanPid, "SIGTERM");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH")
        cleanupError = error;
    }
  }
  const result = await resultPromise;
  await rm(fixture, { recursive: true, force: true });
  if (cleanupError) throw cleanupError;

  expect(settled).not.toBeNull();
  expect(result).toEqual({
    out: "captured",
    err: "warning",
    code: 0,
    timedOut: false,
    lost: false,
  });
});

test("kills a process at its deadline and returns a structured failure", async () => {
  const proc = Bun.spawn(
    ["/bin/sh", "-c", "printf started; printf warning >&2; exec sleep 30"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const resultPromise = captureProcess(proc, {
    timeoutMs: 50,
    drainTimeoutMs: 25,
  });
  const settled = await Promise.race([
    resultPromise.then((result) => result),
    Bun.sleep(750).then(() => null),
  ]);
  if (!settled) proc.kill();
  const result = await resultPromise;

  expect(settled).not.toBeNull();
  expect(result).toEqual({
    out: "started",
    err: "warning\nprocess timed out after 50ms",
    code: 124,
    timedOut: true,
    lost: false,
  });
});

test("fails when the OS child disappears without settling its exit promise", async () => {
  const exited = Bun.spawn(["/usr/bin/true"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  const missingPid = exited.pid;
  await exited.exited;
  const encoder = new TextEncoder();
  const stream = (text: string) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    });

  const result = await captureProcess(
    {
      pid: missingPid,
      stdout: stream("partial"),
      stderr: stream("warning"),
      exited: new Promise<number>(() => {}),
      kill() {
        throw new Error("missing process must not be killed");
      },
    },
    {
      timeoutMs: 250,
      drainTimeoutMs: 25,
      livenessIntervalMs: 10,
    },
  );

  expect(result).toEqual({
    out: "partial",
    err: "warning\nprocess disappeared before reporting an exit status",
    code: 125,
    timedOut: false,
    lost: true,
  });
});
