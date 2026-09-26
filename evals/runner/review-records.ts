type ReviewObject = Record<string, unknown>;

export function parseRecords(content: string): ReviewObject {
  const parsed: unknown = JSON.parse(content);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("review record must be a JSON object");
  return parsed as ReviewObject;
}

export function routeFields(
  record: ReviewObject,
  key: string,
): [string, string, string, string] {
  const route = record[key];
  if (route === null || typeof route !== "object" || Array.isArray(route))
    throw new Error(`${key} must be a route object`);
  const fields = ["host", "provider", "model", "effort"].map(
    (field) => (route as ReviewObject)[field],
  );
  if (fields.some((field) => typeof field !== "string" || !field))
    throw new Error(`${key} must contain four route strings`);
  return fields as [string, string, string, string];
}

export function oneValue(record: ReviewObject, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value)
    throw new Error(`${key} must contain one non-empty value`);
  return value;
}
