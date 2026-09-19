export const RUNNER_COMMAND_ENV = "DARROW_EVAL_RUNNER_COMMAND";

export interface CompatibilityPaths {
  projectRoot: string;
  resultsRoot: string;
  runnerPath: string;
  syntheticAdapter: string;
}

const placeholders: Record<keyof CompatibilityPaths, string> = {
  projectRoot: "{projectRoot}",
  resultsRoot: "{resultsRoot}",
  runnerPath: "{runnerPath}",
  syntheticAdapter: "{syntheticAdapter}",
};

function configuredArgv(encoded: string | undefined): string[] | undefined {
  if (encoded === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    throw new Error(`${RUNNER_COMMAND_ENV} must be a JSON argv array`);
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    !parsed.every((value) => typeof value === "string" && value.length > 0)
  ) {
    throw new Error(
      `${RUNNER_COMMAND_ENV} must be a non-empty JSON argv array`,
    );
  }
  return parsed;
}

function expandArgument(argument: string, paths: CompatibilityPaths): string {
  return (Object.keys(placeholders) as Array<keyof CompatibilityPaths>).reduce(
    (expanded, key) => expanded.replaceAll(placeholders[key], paths[key]),
    argument,
  );
}

export function compatibilityRunnerCommand(
  paths: CompatibilityPaths,
  encoded = process.env[RUNNER_COMMAND_ENV],
): string[] {
  const configured = configuredArgv(encoded);
  const argv = configured ?? [
    process.execPath,
    "--preload",
    placeholders.syntheticAdapter,
    placeholders.runnerPath,
  ];
  return argv.map((argument) => expandArgument(argument, paths));
}
