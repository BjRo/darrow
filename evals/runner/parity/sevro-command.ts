import { isAbsolute, join } from "node:path";

/** Select an installed CLI or the explicit local-development checkout. */
export function sevroCommand(): {
  launch: string[];
  extraArgs: string[];
  source: "package" | "checkout";
} {
  const packageBin = process.env.SEVRO_PACKAGE_BIN;
  const checkout = process.env.SEVRO_CHECKOUT;
  if (Boolean(packageBin) === Boolean(checkout))
    throw new Error(
      "select exactly one of SEVRO_PACKAGE_BIN or SEVRO_CHECKOUT",
    );
  if (packageBin) {
    if (!isAbsolute(packageBin))
      throw new Error("SEVRO_PACKAGE_BIN must be absolute");
    return { launch: [packageBin], extraArgs: [], source: "package" };
  }
  if (!checkout || !isAbsolute(checkout))
    throw new Error("SEVRO_CHECKOUT must be absolute");
  return {
    launch: [process.execPath, join(checkout, "src/cli.ts")],
    extraArgs: ["--runner-checkout-root", checkout],
    source: "checkout",
  };
}
