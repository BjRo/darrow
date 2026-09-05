type ChildProcess = { pid: number; exited: Promise<number> };
const children = new Set<ChildProcess>();
let interruption: Error | undefined;
let signal: "SIGINT" | "SIGTERM" | undefined;
let settlement: Promise<void> | undefined;

function terminateGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

/** Callers spawn detached groups so cancellation reaches tools and descendants. */
export function trackEvaluationProcess<T extends ChildProcess>(child: T): T {
  children.add(child);
  void child.exited.then(
    () => children.delete(child),
    () => children.delete(child),
  );
  if (interruption) terminateGroup(child.pid, "SIGKILL");
  return child;
}

async function stopChildren(active: ChildProcess[]): Promise<void> {
  for (const child of active) terminateGroup(child.pid, "SIGTERM");
  // A shell can exit before a descendant which ignores TERM. Keep the original
  // group IDs through escalation rather than relying on only the leader's exit.
  await Bun.sleep(1000);
  for (const child of active) terminateGroup(child.pid, "SIGKILL");
  await Promise.all(active.map((child) => child.exited));
}

export function installRunSignals(): () => void {
  const interrupt = (received: "SIGINT" | "SIGTERM") => {
    if (interruption) return;
    signal = received;
    interruption = new Error(`evaluation interrupted by ${received}`);
    settlement = stopChildren([...children]);
  };
  const onInt = () => interrupt("SIGINT");
  const onTerm = () => interrupt("SIGTERM");
  process.on("SIGINT", onInt);
  process.on("SIGTERM", onTerm);
  return () => {
    process.off("SIGINT", onInt);
    process.off("SIGTERM", onTerm);
  };
}

export function throwIfInterrupted(): void {
  if (interruption) throw interruption;
}

export async function settleInterruption(): Promise<Error | undefined> {
  await settlement;
  return interruption;
}

export function interruptionExitCode(): number | undefined {
  return signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : undefined;
}
