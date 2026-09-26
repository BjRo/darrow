import {
  mkdtemp,
  writeFile,
  mkdir,
  cp,
  rm,
  readdir,
  readFile,
  symlink,
} from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";
import type { Fixture } from "./types";
import { trialReviewStateDir } from "./environment";

const TICKETCTL = `#!/bin/bash
set -euo pipefail
git_dir=$(git rev-parse --git-dir)
case "$git_dir" in /*) ;; *) git_dir="$PWD/$git_dir" ;; esac
ticket_id=$(<"$git_dir/fixture-ticket-id")
ticket_title=$(<"$git_dir/fixture-ticket-title")
ticket_body="$git_dir/fixture-ticket.md"
log="$git_dir/fixture-state/ticketctl.log"

usage() {
  echo "usage: ticketctl get <id> --body-file <path> | describe <id> --body-file <path>" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
command=$1
shift
if [[ "$command" == "help" || "$command" == "--help" ]]; then
  echo "get <id> --body-file <path>"
  echo "describe <id> --body-file <path>"
  exit 0
fi
[[ $# -eq 3 && "$2" == "--body-file" ]] || usage
[[ "$1" == "$ticket_id" ]] || { echo "error: ticket not found: $1" >&2; exit 1; }
body_file=$3

case "$command" in
  get)
    cp "$ticket_body" "$body_file"
    printf 'id: %s\nstate: open\ntitle: %s\n' "$ticket_id" "$ticket_title"
    printf 'get %s\n' "$ticket_id" >>"$log"
    ;;
  describe)
    [[ -f "$body_file" ]] || { echo "error: unreadable body file" >&2; exit 1; }
    cp "$body_file" "$ticket_body"
    printf 'describe %s\n' "$ticket_id" >>"$log"
    printf 'updated: %s\n' "$ticket_id"
    ;;
  *) usage ;;
esac
`;

async function git(repoDir: string, ...args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0)
    throw new Error(`git ${args.join(" ")} failed (${code}): ${err}`);
  return out;
}

async function writeFiles(
  repoDir: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const abs = join(repoDir, path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
}

/** Clone or initialise the fixture's git repo with a deterministic identity. */
async function initFixtureRepo(
  repoDir: string,
  fixture: Fixture,
): Promise<void> {
  if (fixture.repo) {
    if (fixture.commits?.length)
      throw new Error("fixture: repo and commits are mutually exclusive");
    await git(repoDir, "clone", "--local", "--no-hardlinks", fixture.repo, ".");
    // The eval clone must have no route back to the source repo.
    await git(repoDir, "remote", "remove", "origin");
  } else {
    await git(repoDir, "init", "-b", "main");
  }
  await git(repoDir, "config", "user.name", "Eval Fixture");
  await git(repoDir, "config", "user.email", "fixture@darrow.local");
}

/** Lay down the fixture's history, working tree, index, hooks, and stub bin. */
async function applyFixtureContent(
  repoDir: string,
  fixture: Fixture,
): Promise<void> {
  for (const commit of fixture.commits ?? []) {
    await writeFiles(repoDir, commit.files);
    await git(repoDir, "add", ...Object.keys(commit.files));
    await git(repoDir, "commit", "-m", commit.message);
  }

  if (fixture.files) {
    await writeFiles(repoDir, fixture.files);
    if (fixture.commit_files) {
      await git(repoDir, "add", ...Object.keys(fixture.files));
      await git(repoDir, "commit", "-m", "Add evaluation scaffolding");
    }
  } else if (fixture.commit_files) {
    throw new Error("fixture: commit_files requires files");
  }
  if (fixture.staged?.length) await git(repoDir, "add", ...fixture.staged);
  await mkdir(join(repoDir, ".git", "fixture-state"), { recursive: true });
  await writeFixtureExecutables(repoDir, fixture);
}

/** Install the fixture's git hooks and stub binaries, both mode 0755. */
async function writeFixtureExecutables(
  repoDir: string,
  fixture: Fixture,
): Promise<void> {
  for (const [name, content] of Object.entries(fixture.hooks ?? {})) {
    const hookPath = join(repoDir, ".git", "hooks", name);
    await writeFile(hookPath, content, { mode: 0o755 });
  }
  if (!fixture.bin) return;
  const binDir = join(repoDir, ".git", "fixture-bin");
  await mkdir(binDir, { recursive: true });
  for (const [name, content] of Object.entries(fixture.bin)) {
    await writeFile(join(binDir, name), content, { mode: 0o755 });
  }
}

/** Provision the local `ticketctl` stub and its single fixture ticket. */
async function provisionFixtureTicket(
  repoDir: string,
  ticket: NonNullable<Fixture["ticket"]>,
): Promise<void> {
  if (!/^[A-Za-z0-9._-]+$/.test(ticket.id))
    throw new Error("fixture: ticket id contains unsupported characters");
  if (/[\r\n]/.test(ticket.title))
    throw new Error("fixture: ticket title must be one line");
  const gitDir = join(repoDir, ".git");
  const binDir = join(gitDir, "fixture-bin");
  await mkdir(binDir, { recursive: true });
  await Promise.all([
    writeFile(join(binDir, "ticketctl"), TICKETCTL, { mode: 0o755 }),
    writeFile(join(gitDir, "fixture-ticket-id"), ticket.id + "\n"),
    writeFile(join(gitDir, "fixture-ticket-title"), ticket.title + "\n"),
    writeFile(join(gitDir, "fixture-ticket.md"), ticket.body),
    writeFile(join(gitDir, "fixture-state", "ticketctl.log"), ""),
    symlink("fixture-state/ticketctl.log", join(gitDir, "ticketctl.log")),
  ]);
}

async function runFixtureSetup(
  repoDir: string,
  script: string,
  caseDir: string,
): Promise<void> {
  const setup = script.replaceAll("{{case_dir}}", "$DARROW_EVAL_CASE_DIR");
  throwIfInterrupted();
  const proc = trackEvaluationProcess(
    Bun.spawn(["bash", "-c", setup], {
      detached: true,
      cwd: repoDir,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
        DARROW_EVAL_CASE_DIR: caseDir,
        DARROW_REVIEW_STATE_DIR: trialReviewStateDir(repoDir),
      },
    }),
  );
  const [err, code] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`fixture setup failed (${code}): ${err}`);
}

/** Resolve which skill directories a mount receives: just the case's skill, or
 * every sibling skill in the same plugin. */
async function resolveMountedSkillDirs(
  skillDir: string,
  mountPluginSkills: boolean,
  additionalSkillDirs: string[] = [],
): Promise<string[]> {
  const primary = mountPluginSkills
    ? (await readdir(dirname(skillDir), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(dirname(skillDir), entry.name))
    : [skillDir];
  return [...new Set([...primary, ...additionalSkillDirs])];
}

async function copySkillWithoutEvals(
  mountedSkillDir: string,
  destination: string,
): Promise<void> {
  const generatedEntries = new Set([
    ".coverage",
    ".hypothesis",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "coverage.json",
    "evals",
  ]);
  await cp(mountedSkillDir, destination, {
    recursive: true,
    // Never expose any skill's colocated pass criteria to the model.
    filter: (src) =>
      relative(mountedSkillDir, src)
        .split(sep)
        .every((entry) => !generatedEntries.has(entry)),
  });
}

interface PluginMountPaths {
  backend: string;
  manifest: string;
  codexManifest: string;
  agents: string;
  bin: string;
  config: string;
  hooks: string;
}

async function mountPluginMechanics(
  repoDir: string,
  mount: string,
  paths: PluginMountPaths,
): Promise<void> {
  const pluginRoot = join(repoDir, mount, "..");
  if (existsSync(paths.manifest)) {
    await mkdir(join(pluginRoot, ".claude-plugin"), { recursive: true });
    await cp(paths.manifest, join(pluginRoot, ".claude-plugin", "plugin.json"));
  }
  if (existsSync(paths.codexManifest)) {
    await mkdir(join(pluginRoot, ".codex-plugin"), { recursive: true });
    await cp(
      paths.codexManifest,
      join(pluginRoot, ".codex-plugin", "plugin.json"),
    );
  }
  if (existsSync(paths.backend))
    await copySkillWithoutEvals(
      paths.backend,
      join(repoDir, mount, "..", "backend"),
    );
  if (existsSync(paths.bin))
    await cp(paths.bin, join(repoDir, mount, "..", "bin"), { recursive: true });
  if (existsSync(paths.config))
    await cp(paths.config, join(repoDir, mount, "..", "config"), {
      recursive: true,
    });
  if (mount.startsWith(".claude/") && existsSync(paths.agents))
    await cp(paths.agents, join(repoDir, ".claude", "agents"), {
      recursive: true,
    });
}

async function mountSourceClaudePlugin(
  repoDir: string,
  skillDirs: string[],
  paths: PluginMountPaths,
  evalPlugin = join(repoDir, ".git", "eval-plugin"),
): Promise<void> {
  await mkdir(join(evalPlugin, ".claude-plugin"), { recursive: true });
  await copySkillWithoutEvals(
    dirname(paths.manifest),
    join(evalPlugin, ".claude-plugin"),
  );
  if (existsSync(paths.codexManifest)) {
    await mkdir(join(evalPlugin, ".codex-plugin"), { recursive: true });
    await cp(
      paths.codexManifest,
      join(evalPlugin, ".codex-plugin", "plugin.json"),
    );
  }
  for (const mountedSkillDir of skillDirs) {
    const name = mountedSkillDir.split("/").filter(Boolean).pop()!;
    await copySkillWithoutEvals(
      mountedSkillDir,
      join(evalPlugin, "skills", name),
    );
  }
  if (existsSync(paths.agents))
    await cp(paths.agents, join(evalPlugin, "agents"), { recursive: true });
  if (existsSync(paths.bin))
    await cp(paths.bin, join(evalPlugin, "bin"), { recursive: true });
  if (existsSync(paths.config))
    await cp(paths.config, join(evalPlugin, "config"), { recursive: true });
  if (existsSync(paths.hooks))
    await cp(paths.hooks, join(evalPlugin, "hooks"), { recursive: true });
  if (existsSync(paths.backend))
    await copySkillWithoutEvals(paths.backend, join(evalPlugin, "backend"));
}

async function mountSourceCodexPlugin(
  skillDirs: string[],
  paths: PluginMountPaths,
  plugin: string,
): Promise<string> {
  await mkdir(join(plugin, ".claude-plugin"), { recursive: true });
  await mkdir(join(plugin, ".codex-plugin"), { recursive: true });
  await copySkillWithoutEvals(
    dirname(paths.manifest),
    join(plugin, ".claude-plugin"),
  );
  await cp(paths.codexManifest, join(plugin, ".codex-plugin", "plugin.json"));
  for (const mountedSkillDir of skillDirs) {
    const name = mountedSkillDir.split("/").filter(Boolean).pop()!;
    await copySkillWithoutEvals(mountedSkillDir, join(plugin, "skills", name));
  }
  if (existsSync(paths.agents))
    await cp(paths.agents, join(plugin, "agents"), { recursive: true });
  if (existsSync(paths.bin))
    await cp(paths.bin, join(plugin, "bin"), { recursive: true });
  if (existsSync(paths.config))
    await cp(paths.config, join(plugin, "config"), { recursive: true });
  if (existsSync(paths.hooks))
    await cp(paths.hooks, join(plugin, "hooks"), { recursive: true });
  if (existsSync(paths.backend))
    await copySkillWithoutEvals(paths.backend, join(plugin, "backend"));
  const manifest = JSON.parse(await readFile(paths.codexManifest, "utf8")) as {
    name?: unknown;
  };
  if (typeof manifest.name !== "string" || !manifest.name)
    throw new Error(
      `source plugin manifest has no name: ${paths.codexManifest}`,
    );
  return manifest.name;
}

async function pluginSkillDirs(pluginRoot: string): Promise<string[]> {
  const skillsRoot = join(pluginRoot, "skills");
  if (!existsSync(skillsRoot)) return [];
  return (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(skillsRoot, entry.name));
}

interface SourcePluginPackage {
  key: string;
  paths: PluginMountPaths;
  skillDirs: string[];
}

async function sourcePluginPackages(
  primarySkillDirs: string[],
  primaryPaths: PluginMountPaths,
  additionalPluginRoots: string[],
): Promise<SourcePluginPackage[]> {
  const packages: SourcePluginPackage[] = [
    { key: "primary", paths: primaryPaths, skillDirs: primarySkillDirs },
  ];
  for (const [index, pluginRoot] of additionalPluginRoots.entries()) {
    packages.push({
      key: `${index}-${basename(pluginRoot)}`,
      paths: pluginMountPaths("", pluginRoot),
      skillDirs: await pluginSkillDirs(pluginRoot),
    });
  }
  return packages;
}

async function writeCodexMarketplace(
  marketplace: string,
  plugins: Array<{ name: string; source: string }>,
): Promise<void> {
  await mkdir(join(marketplace, ".claude-plugin"), { recursive: true });
  await writeFile(
    join(marketplace, ".claude-plugin", "marketplace.json"),
    JSON.stringify(
      {
        name: "darrow-eval",
        owner: { name: "Darrow eval" },
        plugins: plugins.map(({ name, source }) => ({
          name,
          source,
          description: "Filtered source plugin for evaluation",
        })),
      },
      null,
      2,
    ) + "\n",
  );
}

function pluginMountPaths(
  skillDir: string,
  sourcePluginRoot?: string,
): PluginMountPaths {
  const pluginRoot = sourcePluginRoot ?? dirname(dirname(skillDir));
  return {
    backend: join(pluginRoot, "backend"),
    bin: join(pluginRoot, "bin"),
    config: join(pluginRoot, "config"),
    agents: join(pluginRoot, "agents"),
    manifest: join(pluginRoot, ".claude-plugin", "plugin.json"),
    codexManifest: join(pluginRoot, ".codex-plugin", "plugin.json"),
    hooks: join(pluginRoot, "hooks"),
  };
}

async function mountClaudeSourcePlugins(
  repoDir: string,
  packages: SourcePluginPackage[],
  includePrimary = true,
): Promise<void> {
  for (const [index, source] of packages.entries()) {
    if (index === 0 && !includePrimary) continue;
    if (!existsSync(source.paths.manifest)) {
      if (index === 0) continue;
      throw new Error(
        `additional source plugin has no Claude manifest: ${source.paths.manifest}`,
      );
    }
    const destination =
      index === 0
        ? join(repoDir, ".git", "eval-plugin")
        : join(repoDir, ".git", "eval-plugins", source.key);
    await mountSourceClaudePlugin(
      repoDir,
      source.skillDirs,
      source.paths,
      destination,
    );
  }
}

async function mountCodexSourcePlugins(
  repoDir: string,
  packages: SourcePluginPackage[],
  includePrimary = true,
): Promise<void> {
  const marketplace = join(repoDir, ".git", "eval-marketplace");
  const entries: Array<{ name: string; source: string }> = [];
  for (const [index, source] of packages.entries()) {
    if (index === 0 && !includePrimary) continue;
    if (
      !existsSync(source.paths.manifest) ||
      !existsSync(source.paths.codexManifest)
    ) {
      if (index === 0) continue;
      throw new Error(
        `additional source plugin has incomplete manifests: ${source.paths.codexManifest}`,
      );
    }
    const relativePlugin = index === 0 ? "plugin" : join("plugins", source.key);
    const name = await mountSourceCodexPlugin(
      source.skillDirs,
      source.paths,
      join(marketplace, relativePlugin),
    );
    entries.push({ name, source: `./${relativePlugin}` });
  }
  if (entries.length) await writeCodexMarketplace(marketplace, entries);
}

async function mountProjectSkills(
  repoDir: string,
  skillMounts: string[],
  skillDirs: string[],
  paths?: PluginMountPaths,
): Promise<void> {
  for (const mount of skillMounts) {
    for (const mountedSkillDir of skillDirs) {
      const mountedSkillName = basename(mountedSkillDir);
      await copySkillWithoutEvals(
        mountedSkillDir,
        join(repoDir, mount, mountedSkillName),
      );
    }
    if (paths) await mountPluginMechanics(repoDir, mount, paths);
  }
}

async function mountSkills(
  repoDir: string,
  options: Pick<
    BuildFixtureOptions,
    | "skillDir"
    | "skillMounts"
    | "mountPluginSkills"
    | "sourcePluginRoot"
    | "additionalSkillDirs"
    | "additionalPluginRoots"
    | "sourceClaudePlugin"
    | "sourceCodexPlugin"
    | "repositorySkill"
  >,
): Promise<void> {
  const {
    skillDir,
    skillMounts,
    mountPluginSkills = false,
    sourcePluginRoot,
    additionalSkillDirs = [],
    additionalPluginRoots = [],
    sourceClaudePlugin = false,
    sourceCodexPlugin = false,
    repositorySkill = false,
  } = options;
  const paths = pluginMountPaths(skillDir, sourcePluginRoot);
  const skillDirs = await resolveMountedSkillDirs(
    skillDir,
    mountPluginSkills,
    additionalSkillDirs,
  );
  await mountProjectSkills(
    repoDir,
    skillMounts,
    skillDirs,
    repositorySkill ? undefined : paths,
  );
  const packages = await sourcePluginPackages(
    skillDirs,
    paths,
    additionalPluginRoots,
  );
  // Repository skills remain project skills even if host config contains manifests.
  if (sourceClaudePlugin)
    await mountClaudeSourcePlugins(repoDir, packages, !repositorySkill);
  if (sourceCodexPlugin)
    await mountCodexSourcePlugins(repoDir, packages, !repositorySkill);
}

async function writeSkillMountExcludes(
  repoDir: string,
  skillMounts: string[],
): Promise<void> {
  // Setup scripts may snapshot preserved work before the mounts are copied.
  // Hide their reserved roots first so harness infrastructure never becomes
  // part of a user-work baseline.
  const excludes = skillMounts.map((m) => `/${m.split("/")[0]}/`).join("\n");
  await writeFile(join(repoDir, ".git", "info", "exclude"), excludes + "\n");
}

export interface BuildFixtureOptions {
  /** Mount the primary skill through native project discovery only. */
  repositorySkill?: boolean;
  fixture: Fixture;
  /** Skill under evaluation; empty for skill-less experiment cases. */
  skillDir: string;
  /** Repo-relative directories the skill is copied into. */
  skillMounts: string[];
  /** Mount every sibling skill of the plugin, not just `skillDir`. */
  mountPluginSkills?: boolean;
  /** Optional plugin root supplying manifests, agents, and executable mechanics. */
  sourcePluginRoot?: string;
  /** Extra skill directories mounted into the filtered source plugin. */
  additionalSkillDirs?: string[];
  /** Extra plugin roots mounted as independent source plugins. */
  additionalPluginRoots?: string[];
  /** Build a Claude plugin from the source plugin instead of project discovery. */
  sourceClaudePlugin?: boolean;
  /** Build a local marketplace for an isolated installed Codex plugin. */
  sourceCodexPlugin?: boolean;
  /** Value of `{{case_dir}}` / `$DARROW_EVAL_CASE_DIR` in `fixture.setup`. */
  caseDir?: string;
}

/** Builds a temp git repo per the fixture and mounts the skill into the given dirs. */
export async function buildFixture(
  options: BuildFixtureOptions,
): Promise<string> {
  const { fixture, skillDir, caseDir = "" } = options;
  const repoDir = realpathSync(await mkdtemp(join(tmpdir(), "darrow-eval-")));
  await initFixtureRepo(repoDir, fixture);
  await applyFixtureContent(repoDir, fixture);
  if (fixture.ticket) await provisionFixtureTicket(repoDir, fixture.ticket);
  if (skillDir) await writeSkillMountExcludes(repoDir, options.skillMounts);
  if (fixture.setup) await runFixtureSetup(repoDir, fixture.setup, caseDir);

  // Skill-less cases (experiments) mount nothing.
  if (skillDir) await mountSkills(repoDir, options);

  return repoDir;
}

export async function destroyFixture(repoDir: string): Promise<void> {
  const reviewStateDir = trialReviewStateDir(repoDir);
  if (!existsSync(repoDir)) {
    await rm(reviewStateDir, { recursive: true, force: true });
    return;
  }
  let removalError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const writable = Bun.spawn(["chmod", "-R", "u+rwX", repoDir], {
      stdout: "ignore",
      stderr: "pipe",
    });
    const [stderr, code] = await Promise.all([
      new Response(writable.stderr).text(),
      writable.exited,
    ]);
    if (code !== 0 && existsSync(repoDir)) {
      throw new Error(`cannot make eval fixture removable: ${stderr.trim()}`);
    }
    try {
      await rm(repoDir, {
        recursive: true,
        force: true,
        maxRetries: 2,
        retryDelay: 100,
      });
    } catch (error) {
      removalError = error;
    }
    if (!existsSync(repoDir)) {
      await rm(reviewStateDir, { recursive: true, force: true });
      return;
    }
    await Bun.sleep(Math.min(100 * 2 ** attempt, 1_000));
  }
  throw removalError ?? new Error(`cannot remove eval fixture: ${repoDir}`);
}
import { throwIfInterrupted, trackEvaluationProcess } from "./run-control";
