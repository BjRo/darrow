export type CaseMatch = "substring" | "exact";

/** Select case IDs and fail closed when an exact benchmark declaration drifts. */
export function selectCaseIds(
  caseIds: string[],
  filters: string[] | undefined,
  match: CaseMatch = "substring",
): string[] {
  if (!filters?.length) return caseIds;
  if (match === "substring") {
    return caseIds.filter((id) =>
      filters.some((filter) => id.includes(filter)),
    );
  }
  if (new Set(filters).size !== filters.length) {
    throw new Error("exact case filters must be unique");
  }
  const available = new Set(caseIds);
  const missing = filters.filter((filter) => !available.has(filter));
  if (missing.length) {
    throw new Error(
      `exact case filters matched no case: ${missing.join(", ")}`,
    );
  }
  const collisions = filters.filter(
    (filter) => caseIds.filter((id) => id === filter).length !== 1,
  );
  if (collisions.length) {
    throw new Error(
      `exact case filters must match one case: ${collisions.join(", ")}`,
    );
  }
  return caseIds.filter((id) => filters.includes(id));
}
