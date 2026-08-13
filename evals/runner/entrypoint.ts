import { basename, dirname } from "node:path";

export type EvaluationHarness = "claude" | "codex";

/** Return the host-native, plugin-qualified invocation for one mounted skill. */
export function qualifiedSkillEntrypoint(
  harness: EvaluationHarness,
  skillDir: string,
): string {
  if (!skillDir) throw new Error("cannot derive an entrypoint without a skill");
  const skill = basename(skillDir);
  const plugin = basename(dirname(dirname(skillDir)));
  if (!skill || !plugin)
    throw new Error(`cannot derive a qualified entrypoint from ${skillDir}`);
  return `${harness === "claude" ? "/" : "$"}${plugin}:${skill}`;
}

/** Render only the explicit entrypoint seam; the workload body stays unchanged. */
export function renderEntrypointTemplate(
  template: string,
  entrypoint: string | undefined,
  rejectUnused = false,
): string {
  const hasPlaceholder = template.includes("{{entrypoint}}");
  if (!hasPlaceholder) {
    if (rejectUnused && entrypoint)
      throw new Error(
        `entrypoint adapter ${entrypoint} was supplied but the workload has no {{entrypoint}} placeholder`,
      );
    return template;
  }
  if (!entrypoint?.trim())
    throw new Error(
      "workload uses {{entrypoint}} but no entrypoint adapter is available",
    );
  return template.replaceAll("{{entrypoint}}", entrypoint);
}
