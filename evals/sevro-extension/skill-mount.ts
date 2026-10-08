import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export type SkillMountConfiguration = {
  skillDir?: string;
  mountPluginSkills?: true;
};

function skillDirectory(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^(plugins\/[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*\/skills|\.agents\/skills)\/[a-z][a-z0-9-]*$/.test(
      value,
    )
  )
    throw new Error(
      "skill override must name a project plugin or repository skill",
    );
  return value;
}

export function skillMountConfiguration(
  value: Record<string, unknown>,
): SkillMountConfiguration {
  if (value.mountPluginSkills !== undefined && value.mountPluginSkills !== true)
    throw new Error("mountPluginSkills configuration must be true");
  return {
    ...(value.skillDir === undefined
      ? {}
      : { skillDir: skillDirectory(value.skillDir) }),
    ...(value.mountPluginSkills === true ? { mountPluginSkills: true } : {}),
  };
}

export async function loadSkillOverride(
  projectRoot: string,
  path: string,
): Promise<string> {
  const skillDir = skillDirectory(
    relative(resolve(projectRoot), path).split(sep).join("/"),
  );
  const root = await realpath(projectRoot);
  const directory = await realpath(join(root, skillDir));
  if (
    directory !== join(root, skillDir) ||
    !(await stat(directory)).isDirectory()
  )
    throw new Error("skill override escapes its declared project directory");
  const body = await realpath(join(directory, "SKILL.md"));
  if (body !== join(directory, "SKILL.md") || !(await stat(body)).isFile())
    throw new Error("skill override requires a regular contained SKILL.md");
  await readFile(body);
  return skillDir;
}

export function skillOverrideOptions(options: {
  skillDir?: string;
  mountPluginSkills?: boolean;
}) {
  if (options.skillDir !== undefined && !isAbsolute(options.skillDir))
    throw new Error("skill override directory must be absolute");
  return {
    ...(options.skillDir ? { skillDir: options.skillDir } : {}),
    ...(options.mountPluginSkills ? { mountPluginSkills: true as const } : {}),
  };
}

export function modeSkillConfig(mode: Record<string, unknown>) {
  if (
    mode.skill_dir !== undefined &&
    (typeof mode.skill_dir !== "string" || !mode.skill_dir.trim())
  )
    throw new Error("skill_dir must be a nonempty path");
  if (
    mode.mount_plugin_skills !== undefined &&
    typeof mode.mount_plugin_skills !== "boolean"
  )
    throw new Error("mount_plugin_skills must be a boolean");
  return {
    ...(mode.skill_dir === undefined
      ? {}
      : { skillDir: mode.skill_dir as string }),
    ...(mode.mount_plugin_skills === true
      ? { mountPluginSkills: true as const }
      : {}),
  };
}

export function skillArguments(
  configuration: SkillMountConfiguration,
  projectRoot: string,
) {
  return [
    ...(configuration.skillDir
      ? ["--skill-dir", join(projectRoot, configuration.skillDir)]
      : []),
    ...(configuration.mountPluginSkills ? ["--mount-plugin-skills"] : []),
  ];
}
