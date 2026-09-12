import { basename, dirname } from "node:path";

export const SKILL_INVOCATION_PLACEHOLDER = "{{skill_invocation}}";

interface ColocatedSkill {
  skillDir: string;
  owningSkillName?: string;
  skillScope?: "repository" | "plugin";
  source_plugin?: string;
}

export function hasExplicitSkillInvocation(template: string): boolean {
  return template.includes(SKILL_INVOCATION_PLACEHOLDER);
}

export function skillInvocationToken(
  harness: string,
  skill: ColocatedSkill,
): string {
  const owningSkillName = skill.owningSkillName;
  if (
    !skill.skillDir ||
    !owningSkillName ||
    basename(skill.skillDir) !== owningSkillName ||
    basename(dirname(skill.skillDir)) !== "skills"
  ) {
    throw new Error(
      "skill_invocation requires a colocated owning skill under a skills directory",
    );
  }

  if (harness === "claude") return `/${owningSkillName}`;
  if (harness === "codex") {
    if (skill.skillScope === "repository") return `$${owningSkillName}`;
    const pluginName = skill.source_plugin
      ? basename(skill.source_plugin)
      : basename(dirname(dirname(skill.skillDir)));
    if (!pluginName) {
      throw new Error(
        "skill_invocation requires a colocated owning skill under a named plugin",
      );
    }
    return `$${pluginName}:${owningSkillName}`;
  }
  throw new Error(
    `skill_invocation does not support harness ${JSON.stringify(harness)}`,
  );
}

/** Render only host-facing prompt syntax; outcome intent stays in the case YAML. */
export function renderParticipantPrompt(
  template: string,
  harness: string,
  skill: ColocatedSkill,
): string {
  if (!hasExplicitSkillInvocation(template)) return template;
  return template.replaceAll(
    SKILL_INVOCATION_PLACEHOLDER,
    skillInvocationToken(harness, skill),
  );
}
