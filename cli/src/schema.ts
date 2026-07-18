import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parseDocument } from "yaml";
import { basename, resolve } from "node:path";
import { DarrowError } from "./errors";
import { readJson, readText } from "./io";
import { SCHEMAS_DIR } from "./paths";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validators = new Map<string, Promise<ValidateFunction>>();

function diagnostics(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map(
      (error) =>
        `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
    )
    .join("; ");
}

export async function validator(schemaName: string): Promise<ValidateFunction> {
  const cached = validators.get(schemaName);
  if (cached) return cached;
  const pending = (async () => {
    const schemaPath = resolve(SCHEMAS_DIR, schemaName);
    const schema = await readJson<Record<string, unknown>>(schemaPath);
    return ajv.compile(schema);
  })();
  validators.set(schemaName, pending);
  return pending;
}

export async function validateSchema(
  schemaName: string,
  value: unknown,
  label: string,
): Promise<void> {
  const validate = await validator(schemaName);
  if (!validate(value))
    throw new DarrowError(
      `${label} does not satisfy ${schemaName}: ${diagnostics(validate.errors)}`,
      "validation",
    );
}

export async function validateExternalSchema(
  schemaPath: string,
  value: unknown,
  label: string,
): Promise<void> {
  const schema = await readJson<Record<string, unknown>>(schemaPath);
  const externalAjv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(externalAjv);
  const validate = externalAjv.compile(schema);
  if (!validate(value))
    throw new DarrowError(
      `${label} does not satisfy ${basename(schemaPath)}: ${diagnostics(validate.errors)}`,
      "validation",
    );
}

export async function readYaml<T>(
  path: string,
  schemaName: string,
): Promise<T> {
  const text = await readText(path);
  const document = parseDocument(text, { uniqueKeys: true, strict: true });
  if (document.errors.length > 0) {
    throw new DarrowError(
      `invalid YAML in ${resolve(path)}: ${document.errors.map((error) => error.message).join("; ")}`,
      "validation",
    );
  }
  const value = document.toJS() as T;
  await validateSchema(schemaName, value, resolve(path));
  return value;
}
