import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

function diagnostics(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map(
      (error) =>
        `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
    )
    .join("; ");
}

export async function validateExternalSchema(
  schemaPath: string,
  value: unknown,
  label: string,
): Promise<void> {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(value))
    throw new Error(
      `${label} does not satisfy ${basename(schemaPath)}: ${diagnostics(validate.errors)}`,
    );
}
