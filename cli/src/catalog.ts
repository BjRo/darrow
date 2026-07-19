import { readdir, realpath } from "node:fs/promises";
import { delimiter, relative, resolve } from "node:path";
import semver from "semver";
import { DarrowError } from "./errors";
import { exists, hashDirectory, readJson } from "./io";
import { SOURCE_PLUGIN_ROOT } from "./paths";
import { validateSchema } from "./schema";
import type {
  ProjectDefinition,
  Scope,
  SkillCandidate,
  SkillMetadata,
} from "./types";

interface Root {
  path: string;
  scope: Scope;
  harnessEnabled: boolean;
}

async function pluginDirectories(root: string, depth = 0): Promise<string[]> {
  if (!(await exists(root))) return [];
  if (
    (await exists(resolve(root, ".codex-plugin", "plugin.json"))) ||
    (await exists(resolve(root, ".claude-plugin", "plugin.json")))
  )
    return [root];
  if (depth >= 5) return [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    throw new DarrowError(
      `cannot read plugin root ${root}: ${String(error)}`,
      "unreadable_file",
    );
  }
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    found.push(
      ...(await pluginDirectories(resolve(root, entry.name), depth + 1)),
    );
  }
  return found;
}

function inside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

async function inspectPlugin(
  pluginDir: string,
  scope: Scope,
  harnessEnabled: boolean,
  harness: "codex" | "claude",
): Promise<SkillCandidate[]> {
  const codexPath = resolve(pluginDir, ".codex-plugin", "plugin.json");
  const claudePath = resolve(pluginDir, ".claude-plugin", "plugin.json");
  const selectedPath = harness === "codex" ? codexPath : claudePath;
  if (!(await exists(selectedPath))) return [];
  const selected = await readJson<{
    name: string;
    version: string;
    skills?: string | string[];
  }>(selectedPath);
  if (typeof selected.skills !== "string" || !selected.skills.startsWith("./"))
    throw new DarrowError(
      `${harness} plugin manifest must declare one relative skills projection: ${selectedPath}`,
      "catalog",
    );
  const unresolvedSkills = resolve(pluginDir, selected.skills);
  let skillsDir: string;
  try {
    const [realPlugin, realSkills] = await Promise.all([
      realpath(pluginDir),
      realpath(unresolvedSkills),
    ]);
    if (!inside(realPlugin, realSkills))
      throw new DarrowError(
        `${harness} skills projection escapes plugin directory: ${selected.skills}`,
        "catalog",
      );
    skillsDir = realSkills;
  } catch (error) {
    if (error instanceof DarrowError) throw error;
    throw new DarrowError(
      `cannot resolve ${harness} skills projection ${unresolvedSkills}: ${String(error)}`,
      "catalog",
    );
  }
  let entries;
  try {
    entries = await readdir(skillsDir, { withFileTypes: true });
  } catch (error) {
    throw new DarrowError(
      `cannot read ${harness} skills projection ${skillsDir}: ${String(error)}`,
      "catalog",
    );
  }
  const darrowEntries: typeof entries = [];
  for (const entry of entries) {
    if (
      entry.isDirectory() &&
      (await exists(resolve(skillsDir, entry.name, "darrow.json")))
    )
      darrowEntries.push(entry);
  }
  if (darrowEntries.length === 0) return [];
  if (!(await exists(codexPath)))
    throw new DarrowError(`plugin is missing ${codexPath}`, "catalog");
  if (!(await exists(claudePath)))
    throw new DarrowError(`plugin is missing ${claudePath}`, "catalog");
  const codex = await readJson<{ name: string; version: string }>(codexPath);
  const claude = await readJson<{ name: string; version: string }>(claudePath);
  if (
    codex.name !== claude.name ||
    codex.version !== claude.version ||
    !semver.valid(codex.version)
  ) {
    throw new DarrowError(
      `plugin manifests disagree or have an invalid version: ${pluginDir}`,
      "catalog",
    );
  }
  const candidates: SkillCandidate[] = [];
  for (const entry of darrowEntries) {
    const skillDir = resolve(skillsDir, entry.name);
    const metadataPath = resolve(skillDir, "darrow.json");
    if (!(await exists(metadataPath))) continue;
    const metadata = await readJson<SkillMetadata>(metadataPath);
    await validateSchema("skill-metadata.schema.json", metadata, metadataPath);
    if (metadata.kind === "command") {
      for (const schemaPath of [metadata.inputSchema, metadata.outputSchema]) {
        const resolved = await realpath(resolve(skillDir, schemaPath));
        const realSkill = await realpath(skillDir);
        if (!inside(realSkill, resolved))
          throw new DarrowError(
            `command schema escapes skill directory: ${schemaPath}`,
            "catalog",
          );
        await readJson(resolved);
      }
    }
    candidates.push({
      id: `${selected.name}:${entry.name}`,
      pluginName: selected.name,
      pluginVersion: selected.version,
      skillName: entry.name,
      skillDir,
      pluginDir,
      scope,
      harnessEnabled,
      metadata,
      digest: await hashDirectory(skillDir),
    });
  }
  return candidates;
}

export async function loadCatalog(
  repoRoot: string,
  project: ProjectDefinition,
  harness: "codex" | "claude",
): Promise<SkillCandidate[]> {
  const roots: Root[] = [];
  for (const path of project.pluginRoots)
    roots.push({
      path: resolve(repoRoot, path),
      scope: "project",
      harnessEnabled: false,
    });
  for (const path of (process.env.DARROW_PLUGIN_ROOTS ?? "")
    .split(delimiter)
    .filter(Boolean))
    roots.push({ path: resolve(path), scope: "user", harnessEnabled: true });
  const codexHome =
    process.env.CODEX_HOME ??
    (process.env.HOME ? resolve(process.env.HOME, ".codex") : undefined);
  if (harness === "codex" && codexHome) {
    const configPath = resolve(codexHome, "config.toml");
    if (await exists(configPath)) {
      let parsed: { plugins?: Record<string, { enabled?: boolean }> };
      try {
        parsed = Bun.TOML.parse(
          await Bun.file(configPath).text(),
        ) as typeof parsed;
      } catch (error) {
        throw new DarrowError(
          `cannot parse Codex plugin configuration ${configPath}: ${String(error)}`,
          "catalog",
        );
      }
      for (const [identity, configuration] of Object.entries(
        parsed.plugins ?? {},
      )) {
        if (configuration.enabled !== true) continue;
        const separator = identity.lastIndexOf("@");
        if (separator < 1) continue;
        const name = identity.slice(0, separator);
        const marketplace = identity.slice(separator + 1);
        const versionsRoot = resolve(
          codexHome,
          "plugins",
          "cache",
          marketplace,
          name,
        );
        if (!(await exists(versionsRoot))) continue;
        const versions = (await readdir(versionsRoot, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory() && semver.valid(entry.name))
          .map((entry) => entry.name)
          .sort(semver.rcompare);
        if (versions[0])
          roots.push({
            path: resolve(versionsRoot, versions[0]),
            scope: "user",
            harnessEnabled: true,
          });
      }
    }
  }
  const claudeHome =
    process.env.CLAUDE_CONFIG_DIR ??
    (process.env.HOME ? resolve(process.env.HOME, ".claude") : undefined);
  if (harness === "claude" && claudeHome) {
    const enabledPlugins: Record<string, boolean> = {};
    for (const settingsPath of [
      resolve(claudeHome, "settings.json"),
      resolve(repoRoot, ".claude", "settings.json"),
      resolve(repoRoot, ".claude", "settings.local.json"),
    ]) {
      if (!(await exists(settingsPath))) continue;
      let settings: { enabledPlugins?: Record<string, boolean> };
      try {
        settings = await readJson<typeof settings>(settingsPath);
      } catch (error) {
        throw new DarrowError(
          `cannot parse Claude Code plugin configuration ${settingsPath}: ${String(error)}`,
          "catalog",
        );
      }
      Object.assign(enabledPlugins, settings.enabledPlugins ?? {});
    }
    for (const [identity, enabled] of Object.entries(enabledPlugins)) {
      if (enabled !== true) continue;
      const separator = identity.lastIndexOf("@");
      if (separator < 1) continue;
      const name = identity.slice(0, separator);
      const marketplace = identity.slice(separator + 1);
      const versionsRoot = resolve(
        claudeHome,
        "plugins",
        "cache",
        marketplace,
        name,
      );
      if (!(await exists(versionsRoot))) continue;
      const versions = (await readdir(versionsRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && semver.valid(entry.name))
        .map((entry) => entry.name)
        .sort(semver.rcompare);
      if (versions[0])
        roots.push({
          path: resolve(versionsRoot, versions[0]),
          scope: "user",
          harnessEnabled: true,
        });
    }
  }
  roots.push({
    path: SOURCE_PLUGIN_ROOT,
    scope: "bundled",
    harnessEnabled: false,
  });
  const seen = new Set<string>();
  const candidates: SkillCandidate[] = [];
  for (const root of roots) {
    const path = await realpath(root.path).catch(() => resolve(root.path));
    const key = `${root.scope}:${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const pluginDir of await pluginDirectories(path))
      candidates.push(
        ...(await inspectPlugin(
          pluginDir,
          root.scope,
          root.harnessEnabled,
          harness,
        )),
      );
  }
  return candidates;
}

const scopes: Scope[] = ["explicit", "project", "user", "bundled"];

function selectScope(
  candidates: SkillCandidate[],
  description: string,
): SkillCandidate {
  for (const scope of scopes) {
    const matches = candidates.filter((candidate) => candidate.scope === scope);
    if (matches.length === 0) continue;
    if (matches.length > 1) {
      throw new DarrowError(
        `ambiguous ${description} in ${scope} scope: ${matches.map((match) => match.skillDir).join(", ")}`,
        "preflight",
      );
    }
    return matches[0]!;
  }
  throw new DarrowError(
    `missing ${description}; configure a compatible plugin root`,
    "preflight",
  );
}

export function resolveCommand(
  catalog: SkillCandidate[],
  id: string,
  range: string,
): SkillCandidate {
  const selected = selectScope(
    catalog.filter(
      (candidate) =>
        candidate.id === id && candidate.metadata.kind === "command",
    ),
    `command ${id}`,
  );
  const version = (
    selected.metadata as Extract<SkillMetadata, { kind: "command" }>
  ).contractVersion;
  if (!semver.satisfies(version, range))
    throw new DarrowError(
      `selected command ${id}@${version} does not satisfy ${range}`,
      "preflight",
    );
  return selected;
}

export function resolveCapability(
  catalog: SkillCandidate[],
  contract: string,
  range: string,
): { candidate: SkillCandidate; version: string } {
  const providers = catalog.filter(
    (candidate) =>
      candidate.harnessEnabled &&
      candidate.metadata.kind === "capability" &&
      candidate.metadata.provides.some((item) => item.contract === contract),
  );
  const selected = selectScope(providers, `capability ${contract}@${range}`);
  const provision = (
    selected.metadata as Extract<SkillMetadata, { kind: "capability" }>
  ).provides.find((item) => item.contract === contract)!;
  if (!semver.satisfies(provision.version, range)) {
    throw new DarrowError(
      `selected capability ${contract}@${provision.version} from ${selected.id} does not satisfy ${range}`,
      "preflight",
    );
  }
  return { candidate: selected, version: provision.version };
}
