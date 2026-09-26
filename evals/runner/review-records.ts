export function parseRecords(content: string): Map<string, string[][]> {
  const parsed: unknown = JSON.parse(content);
  if (!Array.isArray(parsed))
    throw new Error("review record must be a JSON array");
  const rows = new Map<string, string[][]>();
  for (const item of parsed) {
    if (
      !Array.isArray(item) ||
      !item.length ||
      item.some((field) => typeof field !== "string")
    )
      throw new Error("review rows must be nonempty string arrays");
    const [key, ...values] = item as string[];
    if (!key) throw new Error("record contains an empty key");
    rows.set(key, [...(rows.get(key) ?? []), values]);
  }
  return rows;
}

export function oneRow(rows: Map<string, string[][]>, key: string): string[] {
  const found = rows.get(key) ?? [];
  if (found.length !== 1) throw new Error(`record must contain one ${key} row`);
  return found[0] ?? [];
}

export function oneValue(rows: Map<string, string[][]>, key: string): string {
  const values = oneRow(rows, key);
  if (values.length !== 1 || !values[0])
    throw new Error(`${key} must contain one non-empty value`);
  return values[0];
}
