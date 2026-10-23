type RecordValue = Record<string, unknown>;

export const SKILL_ACTIVATIONS = "sevro.host.skill-activations";
export const SKILL_ACTIVATION_CLAIMS = "sevro.host.skill-activation-claims";
export const SKILL_EXPOSURE_CLAIMS = "sevro.host.skill-exposure-claims";

function exposureRecord(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function exposureClaimData(observation: RecordValue): RecordValue | null {
  if (
    observation.id !== SKILL_EXPOSURE_CLAIMS ||
    observation.source !== "sevro.host.codex" ||
    observation.completeness !== "complete"
  )
    return null;
  const data = exposureRecord(observation.data);
  if (
    !data ||
    data.method !== "tool_result_body_match" ||
    data.scope !== "positive_exposure"
  )
    return null;
  if (
    typeof data.collectionStatus !== "string" ||
    !["complete", "partial", "unavailable"].includes(data.collectionStatus)
  )
    return null;
  return data;
}

function positiveExposure(value: unknown, namespaces: string[]) {
  const data = exposureRecord(value);
  if (!data) return null;
  if (
    typeof data.status !== "string" ||
    !["full", "partial"].includes(data.status)
  )
    return null;
  const skill = skillName(data.skill, namespaces);
  return skill ? { skill, status: data.status } : null;
}

function fullExposureMembers(value: unknown, namespaces: string[]) {
  if (!Array.isArray(value) || !value.length) return null;
  const seen = new Set<string>();
  const fullSkills: string[] = [];
  for (const entry of value) {
    const exposure = positiveExposure(entry, namespaces);
    if (!exposure || seen.has(exposure.skill)) return null;
    seen.add(exposure.skill);
    if (exposure.status === "full") fullSkills.push(exposure.skill);
  }
  return fullSkills;
}

/** Complete positive exposure proves only listed body membership, never order. */
export function commonSkillExposureClaims(
  observation: RecordValue,
  namespaces: string[],
) {
  const data = exposureClaimData(observation);
  if (!data) return null;
  const fullSkills = fullExposureMembers(data.skillExposures, namespaces);
  return fullSkills
    ? { fullSkills, collectionStatus: String(data.collectionStatus) }
    : null;
}

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
  const primary = observedSkills[0] ?? null;
  if (!consistentPrimary(observation.source, data, namespaces, primary))
    return { ...observation, completeness: "partial" };
  return {
    ...observation,
    data: {
      ...data,
      qualifiedSkills,
      observedSkills,
      primarySkill: primary,
    },
  };
}

function consistentPrimary(
  source: unknown,
  data: RecordValue,
  namespaces: string[],
  primary: string | null,
): boolean {
  if (
    source !== "sevro.host.codex" ||
    data.primarySkillCompleteness === undefined
  )
    return true;
  if (data.primarySkillCompleteness !== "complete") return false;
  if (data.primarySkill === null) return primary === null;
  const declared = skillName(data.primarySkill, namespaces);
  return declared !== null && declared === primary;
}

function claimData(observation: RecordValue): RecordValue | null {
  const data = observation.data as RecordValue | undefined;
  if (
    observation.id !== SKILL_ACTIVATION_CLAIMS ||
    observation.source !== "sevro.host.codex" ||
    observation.completeness !== "complete" ||
    !data ||
    data.scope !== "primary_and_positive_presence" ||
    data.collectionCompleteness !== "partial" ||
    !Array.isArray(data.presentSkills)
  )
    return null;
  return data;
}

function pairedClaimData(collection: RecordValue): RecordValue | null {
  if (
    collection.source !== "sevro.host.codex" ||
    collection.completeness !== "partial"
  )
    return null;
  const data = collectionData(collection);
  if (data?.primarySkillCompleteness !== "complete") return null;
  return Array.isArray(data.incompleteReasons) &&
    data.incompleteReasons.length === 1 &&
    data.incompleteReasons[0] === "pending_tool_calls"
    ? data
    : null;
}

/** A complete positive claim does not make its paired collection complete. */
export function commonSkillActivationClaims(
  observation: RecordValue,
  collection: RecordValue,
  namespaces: string[],
): RecordValue | null {
  const data = claimData(observation);
  const paired = pairedClaimData(collection);
  if (!data || !paired) return null;
  return normalizedClaim(observation, data, paired, namespaces);
}

function normalizedClaim(
  observation: RecordValue,
  data: RecordValue,
  paired: RecordValue,
  namespaces: string[],
): RecordValue | null {
  const primary = skillName(data.primarySkill, namespaces);
  const present = (data.presentSkills as unknown[]).map((skill) =>
    skillName(skill, namespaces),
  );
  const observed = paired.observedSkills as unknown[];
  if (
    !primary ||
    present.includes(null) ||
    new Set(present).size !== present.length ||
    !present.includes(primary) ||
    paired.primarySkill !== primary ||
    present.length !== observed.length ||
    present.some((skill) => !observed.includes(skill))
  )
    return null;
  return {
    ...observation,
    data: {
      ...data,
      qualifiedSkills: data.presentSkills,
      qualifiedPrimarySkill: data.primarySkill,
      primarySkill: primary,
      observedSkills: [
        primary,
        ...present.filter((skill) => skill !== primary),
      ],
    },
  };
}
