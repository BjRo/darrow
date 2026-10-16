type RecordValue = Record<string, unknown>;

export const SKILL_ACTIVATIONS = "sevro.host.skill-activations";

/** Translate the public collector's qualified identities into Darrow's names. */
function collectionData(observation: RecordValue): RecordValue | null {
  const data = observation.data as RecordValue | undefined;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (
    data.truncated !== false ||
    !Array.isArray(data.calls) ||
    !Array.isArray(data.observedSkills)
  )
    return null;
  if (!commonSkillSource(observation.source, data.method)) return null;
  const healthy =
    observation.source === "sevro.host.codex"
      ? codexCollection(data)
      : data.visibility === "skill_tool";
  return healthy ? data : null;
}

export function commonSkillSource(source: unknown, method: unknown): boolean {
  return (
    (source === "sevro.host.codex" && method === "tool_result_body_match") ||
    (source === "sevro.host.claude" && method === "skill_tool_result")
  );
}

function emptyList(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function codexCollection(data: RecordValue): boolean {
  return (
    data.visibility === "tool_result" &&
    data.scope === "prepared_skill_bodies" &&
    data.catalogComplete === true &&
    emptyList(data.partialSkills) &&
    emptyList(data.ambiguousSkills)
  );
}

function skillName(skill: unknown, namespaces: string[]): string | null {
  if (
    typeof skill !== "string" ||
    !/^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)?$/.test(skill)
  )
    return null;
  const parts = skill.split(":");
  if (parts.length === 2 && !namespaces.includes(parts[0]!)) return null;
  return parts.at(-1)!;
}

export function commonSkillActivation(
  observation: RecordValue,
  namespaces: string[],
): RecordValue {
  const data = collectionData(observation);
  if (!data) return { ...observation, completeness: "partial" };
  const qualifiedSkills = data.observedSkills as unknown[];
  const observedSkills = qualifiedSkills.map((skill) =>
    skillName(skill, namespaces),
  );
  if (
    observedSkills.includes(null) ||
    new Set(observedSkills).size !== observedSkills.length
  )
    return { ...observation, completeness: "partial" };
  return {
    ...observation,
    data: {
      ...data,
      qualifiedSkills,
      observedSkills,
      primarySkill: observedSkills[0] ?? null,
    },
  };
}
