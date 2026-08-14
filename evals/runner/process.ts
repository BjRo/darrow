export interface CapturedProcess {
  out: string;
  err: string;
  code: number;
  timedOut: boolean;
  lost: boolean;
}

export interface ProcessCaptureOptions {
  timeoutMs?: number;
  drainTimeoutMs?: number;
  livenessIntervalMs?: number;
}

interface PipedProcess {
  pid?: number;
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  exited: Promise<number>;
  kill(): void;
}

const DEFAULT_DRAIN_TIMEOUT_MS = 10_000;
const DEFAULT_LIVENESS_INTERVAL_MS = 1_000;
const DEFAULT_PROCESS_TIMEOUT_MS = 30 * 60 * 1_000;
const LOST_PROCESS_EXIT_CODE = 125;
const TIMEOUT_EXIT_CODE = 124;

type ProcessTerminal =
  | { code: number; timedOut: false; lost: false }
  | { code: number; timedOut: true; lost: false }
  | { code: number; timedOut: false; lost: true };

interface StreamCapture {
  completed: Promise<void>;
  cancel(): Promise<void>;
  error(): unknown;
  text(): string;
}

function captureStream(stream: ReadableStream<Uint8Array>): StreamCapture {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let cancelled = false;
  let failure: unknown;
  let text = "";
  const completed = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
    } catch (error) {
      if (!cancelled) failure = error;
    } finally {
      text += decoder.decode();
      reader.releaseLock();
    }
  })();
  return {
    completed,
    async cancel() {
      cancelled = true;
      try {
        await reader.cancel();
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
      }
    },
    error: () => failure,
    text: () => text,
  };
}

async function drainStreams(
  streams: StreamCapture[],
  timeoutMs: number,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const drained = await Promise.race([
    Promise.all(streams.map((stream) => stream.completed)).then(() => true),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  if (timer) clearTimeout(timer);
  if (!drained) await Promise.all(streams.map((stream) => stream.cancel()));
  await Promise.all(streams.map((stream) => stream.completed));
  const failed = streams.map((stream) => stream.error()).find(Boolean);
  if (failed) throw failed;
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function monitorProcess(
  pid: number | undefined,
  intervalMs: number,
): { terminal: Promise<ProcessTerminal>; cancel(): void } {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const terminal = new Promise<ProcessTerminal>(() => {});
  if (!Number.isInteger(pid) || pid! <= 0)
    return { terminal, cancel: () => undefined };

  let resolveTerminal: (value: ProcessTerminal) => void = () => undefined;
  const monitored = new Promise<ProcessTerminal>((resolve) => {
    resolveTerminal = resolve;
  });
  const poll = () => {
    timer = setTimeout(() => {
      if (cancelled) return;
      if (!processIsRunning(pid!)) {
        resolveTerminal({
          code: LOST_PROCESS_EXIT_CODE,
          timedOut: false,
          lost: true,
        });
        return;
      }
      poll();
    }, intervalMs);
  };
  poll();
  return {
    terminal: monitored,
    cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}

async function waitForProcessTerminal(
  proc: PipedProcess,
  timeoutMs: number,
  livenessIntervalMs: number,
): Promise<ProcessTerminal> {
  const monitor = monitorProcess(proc.pid, livenessIntervalMs);
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  const terminal = await Promise.race<ProcessTerminal>([
    proc.exited.then((code) => ({
      code,
      timedOut: false as const,
      lost: false as const,
    })),
    new Promise<ProcessTerminal>((resolve) => {
      timeoutTimer = setTimeout(
        () =>
          resolve({
            code: TIMEOUT_EXIT_CODE,
            timedOut: true,
            lost: false,
          }),
        timeoutMs,
      );
    }),
    monitor.terminal,
  ]);
  monitor.cancel();
  if (timeoutTimer) clearTimeout(timeoutTimer);
  return terminal;
}

async function stopTimedOutProcess(
  proc: PipedProcess,
  drainTimeoutMs: number,
): Promise<void> {
  proc.kill();
  await Promise.race([proc.exited, Bun.sleep(drainTimeoutMs)]);
}

function terminalFailure(terminal: ProcessTerminal, timeoutMs: number): string {
  if (terminal.timedOut) return `process timed out after ${timeoutMs}ms`;
  if (terminal.lost)
    return "process disappeared before reporting an exit status";
  return "";
}

function appendFailure(stderr: string, failure: string): string {
  if (!failure) return stderr;
  const separator = stderr && !stderr.endsWith("\n") ? "\n" : "";
  return `${stderr}${separator}${failure}`;
}

/** Capture a piped subprocess without waiting indefinitely for inherited FDs. */
export async function captureProcess(
  proc: PipedProcess,
  options: ProcessCaptureOptions = {},
): Promise<CapturedProcess> {
  const stdout = captureStream(proc.stdout);
  const stderr = captureStream(proc.stderr);
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROCESS_TIMEOUT_MS;
  const drainTimeoutMs = options.drainTimeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS;
  const livenessIntervalMs =
    options.livenessIntervalMs ?? DEFAULT_LIVENESS_INTERVAL_MS;
  const terminal = await waitForProcessTerminal(
    proc,
    timeoutMs,
    livenessIntervalMs,
  );
  if (terminal.timedOut) await stopTimedOutProcess(proc, drainTimeoutMs);
  await drainStreams([stdout, stderr], drainTimeoutMs);
  const capturedError = stderr.text();
  return {
    out: stdout.text(),
    err: appendFailure(capturedError, terminalFailure(terminal, timeoutMs)),
    code: terminal.code,
    timedOut: terminal.timedOut,
    lost: terminal.lost,
  };
}
