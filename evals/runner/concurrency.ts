/** Map values with bounded concurrency while retaining input order. */
export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  jobs: number,
  run: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(jobs) || jobs < 1) {
    throw new Error("jobs must be a positive integer");
  }

  const results = new Array<R>(values.length);
  let nextIndex = 0;
  let failure: { index: number; error: unknown } | undefined;

  const worker = async (): Promise<void> => {
    while (failure === undefined) {
      const index = nextIndex;
      if (index >= values.length) return;
      nextIndex++;

      try {
        results[index] = await run(values[index]!, index);
      } catch (error) {
        if (failure === undefined) failure = { index, error };
        return;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(jobs, values.length) }, () => worker()),
  );
  if (failure !== undefined) throw failure.error;
  return results;
}
