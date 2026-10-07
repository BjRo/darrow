export type ReviewAxis = "standards" | "spec";

export function reviewAxesFromTaskName(value: unknown): ReviewAxis[] {
  if (typeof value !== "string") return [];
  return (["standards", "spec"] as const).filter((axis) =>
    new RegExp(`(^|[-_])${axis}($|[-_])`).test(value),
  );
}
