import { expect, test } from "bun:test";
import { mapWithConcurrency } from "./concurrency";

test("bounds concurrent work and retains input order", async () => {
  let active = 0;
  let maximumActive = 0;
  const completions: number[] = [];

  const results = await mapWithConcurrency(
    [30, 20, 10, 5],
    3,
    async (delay) => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await Bun.sleep(delay);
      completions.push(delay);
      active--;
      return delay * 2;
    },
  );

  expect(maximumActive).toBe(3);
  expect(completions).not.toEqual([30, 20, 10, 5]);
  expect(results).toEqual([60, 40, 20, 10]);
});

test("one job remains serial", async () => {
  let active = 0;
  let maximumActive = 0;

  await mapWithConcurrency([1, 2, 3], 1, async (value) => {
    active++;
    maximumActive = Math.max(maximumActive, active);
    await Bun.sleep(1);
    active--;
    return value;
  });

  expect(maximumActive).toBe(1);
});

test("rejects invalid worker counts", async () => {
  for (const jobs of [0, 1.5, Number.NaN]) {
    await expect(
      mapWithConcurrency([], jobs, async () => undefined),
    ).rejects.toThrow("jobs must be a positive integer");
  }
});

test("stops dispatching after a failure and waits for active work", async () => {
  const started: number[] = [];
  const settled: number[] = [];

  await expect(
    mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      started.push(value);
      if (value === 1) {
        await Bun.sleep(5);
        throw new Error("worker failed");
      }
      await Bun.sleep(20);
      settled.push(value);
      return value;
    }),
  ).rejects.toThrow("worker failed");

  expect(started).toEqual([1, 2]);
  expect(settled).toEqual([2]);
});
