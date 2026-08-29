import { basename, dirname } from "node:path";

const SKILL_INVOCATION_PLACEHOLDER = "{{skill_invocation}}";

interface ColocatedSkill {
  skillDir: string;
  owningSkillName?: string;
  source_plugin?: string;
}

/** Render only host-facing prompt syntax; outcome intent stays in the case YAML. */
export function renderParticipantPrompt(
  template: string,
  harness: string,
  skill: ColocatedSkill,
): string {
  if (!template.includes(SKILL_INVOCATION_PLACEHOLDER)) return template;

  const owningSkillName = skill.owningSkillName;
  if (
    !skill.skillDir ||
    !owningSkillName ||
    basename(skill.skillDir) !== owningSkillName ||
    basename(dirname(skill.skillDir)) !== "skills"
  ) {
    throw new Error(
      "skill_invocation requires a colocated owning skill under a plugin skills directory",
    );
  }

  let invocation: string;
  if (harness === "claude") {
    invocation = `/${owningSkillName}`;
  } else if (harness === "codex") {
    const pluginName = skill.source_plugin
      ? basename(skill.source_plugin)
      : basename(dirname(dirname(skill.skillDir)));
    if (!pluginName) {
      throw new Error(
        "skill_invocation requires a colocated owning skill under a named plugin",
      );
    }
    invocation = `$${pluginName}:${owningSkillName}`;
  } else {
    throw new Error(
      `skill_invocation does not support harness ${JSON.stringify(harness)}`,
    );
  }

  return template.replaceAll(SKILL_INVOCATION_PLACEHOLDER, invocation);
}
