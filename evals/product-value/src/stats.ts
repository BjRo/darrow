function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function pairedEstimate(
  differences: number[],
  bootstrapSamples: number,
  randomizationSamples: number,
  seed = 12,
): { estimate: number; ciLow: number; ciHigh: number; pValue: number } {
  if (differences.length < 2)
    throw new Error("at least two tasks are required");
  const random = mulberry32(seed);
  const estimate = mean(differences);
  const boot = Array.from({ length: bootstrapSamples }, () =>
    mean(
      Array.from(
        { length: differences.length },
        () => differences[Math.floor(random() * differences.length)]!,
      ),
    ),
  ).sort((a, b) => a - b);
  const quantile = (p: number) =>
    boot[Math.min(boot.length - 1, Math.floor(p * boot.length))]!;
  let extreme = 0;
  for (let sample = 0; sample < randomizationSamples; sample++) {
    const permuted = mean(
      differences.map((difference) =>
        random() < 0.5 ? -difference : difference,
      ),
    );
    if (Math.abs(permuted) >= Math.abs(estimate)) extreme++;
  }
  return {
    estimate,
    ciLow: quantile(0.025),
    ciHigh: quantile(0.975),
    pValue: (extreme + 1) / (randomizationSamples + 1),
  };
}

export function poweredTasks(
  alpha: number,
  power: number,
  pairedSd: number,
  minimumEffect: number,
): number {
  // Frozen normal approximation for two-sided paired inference. The protocol
  // uses alpha=.05 and power=.80; constants are explicit to avoid a statistics
  // package changing the preregistered result.
  if (alpha !== 0.05 || power !== 0.8)
    throw new Error(
      "power calculation currently supports alpha=.05, power=.80",
    );
  return Math.ceil((((1.959964 + 0.841621) * pairedSd) / minimumEffect) ** 2);
}
