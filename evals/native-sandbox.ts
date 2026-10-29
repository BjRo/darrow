export const supportsNativeSandbox =
  process.platform === "darwin" || process.platform === "linux";

export function requireCodexSandbox() {
  const binary = Bun.which("codex");
  if (!binary) {
    throw new Error("Native sandbox checks require the installed codex CLI");
  }
  return binary;
}
