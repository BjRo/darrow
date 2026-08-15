import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { Fixture, SkillActivationObservation } from "./types";
import { captureProcess } from "./process";

export const BLOCKED_EXTERNAL_COMMANDS = ["gh", "glab", "hub", "tea"] as const;
const ACTIVATION_LOG = join(".git", "darrow-eval", "skill-activation.tsv");

function blockedExternalCommand(name: string): string {
  return `#!/bin/sh
printf '%s\n' 'darrow eval: ${name} is disabled unless fixture.bin provides a mock' >&2
exit 86
`;
}

const TICKETCTL = `#!/bin/bash
set -euo pipefail
git_dir=$(git rev-parse --git-dir)
case "$git_dir" in /*) ;; *) git_dir="$PWD/$git_dir" ;; esac
ticket_id=$(<"$git_dir/fixture-ticket-id")
ticket_title=$(<"$git_dir/fixture-ticket-title")
ticket_body="$git_dir/fixture-ticket.md"
log="$git_dir/ticketctl.log"

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
  const { out, err, code } = await captureProcess(proc);
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
  const binDir = join(repoDir, ".git", "fixture-bin");
  await mkdir(binDir, { recursive: true });
  for (const name of BLOCKED_EXTERNAL_COMMANDS) {
    if (fixture.bin?.[name] !== undefined) continue;
    await writeFile(join(binDir, name), blockedExternalCommand(name), {
      mode: 0o755,
    });
  }
  for (const [name, content] of Object.entries(fixture.bin ?? {})) {
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
    writeFile(join(gitDir, "ticketctl.log"), ""),
  ]);
}

async function runFixtureSetup(
  repoDir: string,
  script: string,
  caseDir: string,
): Promise<void> {
  const setup = script.replaceAll("{{case_dir}}", "$DARROW_EVAL_CASE_DIR");
  const proc = Bun.spawn(["bash", "-c", setup], {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      DARROW_EVAL_CASE_DIR: caseDir,
    },
  });
  const { err, code } = await captureProcess(proc);
  if (code !== 0) throw new Error(`fixture setup failed (${code}): ${err}`);
}

/** Resolve which skill directories a mount receives: just the case's skill, or
 * every sibling skill in the same plugin. */
async function resolveMountedSkillDirs(
  skillDir: string,
  mountPluginSkills: boolean,
): Promise<string[]> {
  if (!mountPluginSkills) return [skillDir];
  const skillsRoot = dirname(skillDir);
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(skillsRoot, entry.name));
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function activationProbeAppendix(
  repoDir: string,
  skillName: string,
  token: string,
): string {
  const log = join(repoDir, ACTIVATION_LOG);
  const logDir = dirname(log);
  const line = `${skillName}\t${token}`;
  return `

## Evaluation activation observation

This mounted evaluation copy has one private activation probe. Before any other
workflow step, run this command exactly once. It writes under the fixture's Git
directory, does not alter the worktree, and is not product or workflow state.

\`\`\`sh
probe_line=${shellSingleQuote(line)}
probe_log=${shellSingleQuote(log)}
mkdir -p ${shellSingleQuote(logDir)}
if ! grep -Fqx "$probe_line" "$probe_log" 2>/dev/null; then
  printf '%s\\n' "$probe_line" >>"$probe_log"
fi
\`\`\`
`;
}

async function copySkillWithoutEvals(
  mountedSkillDir: string,
  destination: string,
  activationProbe?: { repoDir: string; token: string },
  allowHeadlessModelInvocation = false,
): Promise<void> {
  const evalsDir = join(mountedSkillDir, "evals");
  await cp(mountedSkillDir, destination, {
    recursive: true,
    // Never expose any skill's colocated pass criteria to the model.
    filter: (src) => src !== evalsDir && !src.startsWith(evalsDir + "/"),
  });
  if (allowHeadlessModelInvocation) {
    const skillFile = join(destination, "SKILL.md");
    const content = await readFile(skillFile, "utf8");
    await writeFile(
      skillFile,
      content.replace(/^disable-model-invocation:\s*true\s*\n/m, ""),
    );
  }
  if (activationProbe) {
    await appendFile(
      join(destination, "SKILL.md"),
      activationProbeAppendix(
        activationProbe.repoDir,
        basename(mountedSkillDir),
        activationProbe.token,
      ),
    );
  }
}

interface PluginMountPaths {
  manifest: string;
  codexManifest: string;
  agents: string;
  bin: string;
  config: string;
}

async function mountPluginMechanics(
  repoDir: string,
  mount: string,
  paths: PluginMountPaths,
): Promise<void> {
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
  options: {
    activationProbe?: { repoDir: string; token: string };
    explicitEntrypointBridgeSkillDir?: string;
  },
): Promise<void> {
  const evalPlugin = join(repoDir, ".git", "eval-plugin");
  await mkdir(join(evalPlugin, ".claude-plugin"), { recursive: true });
  await cp(paths.manifest, join(evalPlugin, ".claude-plugin", "plugin.json"));
  for (const mountedSkillDir of skillDirs) {
    const name = mountedSkillDir.split("/").filter(Boolean).pop()!;
    await copySkillWithoutEvals(
      mountedSkillDir,
      join(evalPlugin, "skills", name),
      options.activationProbe,
      mountedSkillDir === options.explicitEntrypointBridgeSkillDir,
    );
  }
  if (existsSync(paths.agents))
    await cp(paths.agents, join(evalPlugin, "agents"), { recursive: true });
  if (existsSync(paths.bin))
    await cp(paths.bin, join(evalPlugin, "bin"), { recursive: true });
  if (existsSync(paths.config))
    await cp(paths.config, join(evalPlugin, "config"), { recursive: true });
}

async function mountSourceCodexPlugin(
  repoDir: string,
  skillDirs: string[],
  paths: PluginMountPaths,
  activationProbe?: { repoDir: string; token: string },
): Promise<void> {
  const marketplace = join(repoDir, ".git", "eval-marketplace");
  const plugin = join(marketplace, "plugin");
  const pluginName = basename(dirname(dirname(paths.codexManifest)));
  await mkdir(join(marketplace, ".claude-plugin"), { recursive: true });
  await mkdir(join(plugin, ".claude-plugin"), { recursive: true });
  await mkdir(join(plugin, ".codex-plugin"), { recursive: true });
  await writeFile(
    join(marketplace, ".claude-plugin", "marketplace.json"),
    JSON.stringify(
      {
        name: "darrow-eval",
        owner: { name: "Darrow eval" },
        plugins: [
          {
            name: pluginName,
            source: "./plugin",
            description: "Filtered source plugin for evaluation",
          },
        ],
      },
      null,
      2,
    ) + "\n",
  );
  await cp(paths.manifest, join(plugin, ".claude-plugin", "plugin.json"));
  await cp(paths.codexManifest, join(plugin, ".codex-plugin", "plugin.json"));
  for (const mountedSkillDir of skillDirs) {
    const name = mountedSkillDir.split("/").filter(Boolean).pop()!;
    await copySkillWithoutEvals(
      mountedSkillDir,
      join(plugin, "skills", name),
      activationProbe,
    );
  }
  if (existsSync(paths.agents))
    await cp(paths.agents, join(plugin, "agents"), { recursive: true });
  if (existsSync(paths.bin))
    await cp(paths.bin, join(plugin, "bin"), { recursive: true });
  if (existsSync(paths.config))
    await cp(paths.config, join(plugin, "config"), { recursive: true });
}

function pluginMountPaths(skillDir: string): PluginMountPaths {
  const pluginRoot = dirname(dirname(skillDir));
  return {
    bin: join(pluginRoot, "bin"),
    config: join(pluginRoot, "config"),
    agents: join(pluginRoot, "agents"),
    manifest: join(pluginRoot, ".claude-plugin", "plugin.json"),
    codexManifest: join(pluginRoot, ".codex-plugin", "plugin.json"),
  };
}

async function mountSourcePlugins(
  repoDir: string,
  skillDirs: string[],
  paths: PluginMountPaths,
  options: {
    sourceClaudePlugin: boolean;
    sourceCodexPlugin: boolean;
    activationProbe?: { repoDir: string; token: string };
    claudeExplicitEntrypointBridgeSkillDir?: string;
  },
): Promise<void> {
  if (options.sourceClaudePlugin && existsSync(paths.manifest))
    await mountSourceClaudePlugin(repoDir, skillDirs, paths, {
      activationProbe: options.activationProbe,
      explicitEntrypointBridgeSkillDir:
        options.claudeExplicitEntrypointBridgeSkillDir,
    });
  if (
    options.sourceCodexPlugin &&
    existsSync(paths.manifest) &&
    existsSync(paths.codexManifest)
  )
    await mountSourceCodexPlugin(
      repoDir,
      skillDirs,
      paths,
      options.activationProbe,
    );
}

type SkillMountOptions = Pick<
  BuildFixtureOptions,
  | "skillDir"
  | "additionalSkillDirs"
  | "skillMounts"
  | "mountPluginSkills"
  | "sourceClaudePlugin"
  | "sourceCodexPlugin"
  | "activationProbe"
  | "claudeExplicitEntrypointBridge"
>;

function assertUniqueMountedSkillNames(skillDirs: string[]): void {
  const names = skillDirs.map((skillDir) => basename(skillDir));
  if (new Set(names).size !== names.length)
    throw new Error("fixture: mounted skill names must be unique");
}

interface SkillGroupMount {
  skillDirs: string[];
  pluginPaths: PluginMountPaths[];
  activationProbe?: { token: string };
}

async function mountSkillGroup(
  repoDir: string,
  mount: string,
  group: SkillGroupMount,
): Promise<void> {
  for (const skillDir of group.skillDirs) {
    await copySkillWithoutEvals(
      skillDir,
      join(repoDir, mount, basename(skillDir)),
      group.activationProbe
        ? { repoDir, token: group.activationProbe.token }
        : undefined,
    );
  }
  for (const paths of group.pluginPaths)
    await mountPluginMechanics(repoDir, mount, paths);
}

async function mountAdditionalSourceSkills(
  repoDir: string,
  mounts: string[],
  group: SkillGroupMount,
): Promise<void> {
  for (const mount of mounts) {
    await mountSkillGroup(repoDir, mount, group);
    for (const paths of group.pluginPaths) {
      if (existsSync(paths.agents))
        await cp(paths.agents, join(repoDir, mount, "..", "agents"), {
          recursive: true,
        });
    }
  }
}

function sourceSkillMounts(options: SkillMountOptions): string[] {
  return [
    ...(options.sourceClaudePlugin ? [".git/eval-plugin/skills"] : []),
    ...(options.sourceCodexPlugin
      ? [".git/eval-marketplace/plugin/skills"]
      : []),
  ];
}

async function excludeSkillMounts(
  repoDir: string,
  skillMounts: string[],
): Promise<void> {
  const excludes = skillMounts
    .map((mount) => `/${mount.split("/")[0]}/`)
    .join("\n");
  await writeFile(join(repoDir, ".git", "info", "exclude"), excludes + "\n");
}

async function mountSkills(
  repoDir: string,
  options: SkillMountOptions,
): Promise<void> {
  const {
    skillDir,
    additionalSkillDirs = [],
    skillMounts,
    mountPluginSkills = false,
    sourceClaudePlugin = false,
    sourceCodexPlugin = false,
    activationProbe,
    claudeExplicitEntrypointBridge = false,
  } = options;
  const paths = pluginMountPaths(skillDir);
  const primarySkillDirs = await resolveMountedSkillDirs(
    skillDir,
    mountPluginSkills,
  );
  const skillDirs = [...primarySkillDirs, ...additionalSkillDirs];
  assertUniqueMountedSkillNames(skillDirs);
  const additionalPaths = additionalSkillDirs.map(pluginMountPaths);
  const allSkills = {
    skillDirs,
    pluginPaths: [paths, ...additionalPaths],
    activationProbe,
  };
  for (const mount of skillMounts)
    await mountSkillGroup(repoDir, mount, allSkills);
  await mountSourcePlugins(repoDir, primarySkillDirs, paths, {
    sourceClaudePlugin,
    sourceCodexPlugin,
    activationProbe: activationProbe
      ? { repoDir, token: activationProbe.token }
      : undefined,
    claudeExplicitEntrypointBridgeSkillDir: claudeExplicitEntrypointBridge
      ? skillDir
      : undefined,
  });
  await mountAdditionalSourceSkills(repoDir, sourceSkillMounts(options), {
    skillDirs: additionalSkillDirs,
    pluginPaths: additionalPaths,
    activationProbe,
  });
  await excludeSkillMounts(repoDir, skillMounts);
}

export interface BuildFixtureOptions {
  fixture: Fixture;
  /** Skill under evaluation; empty for skill-less experiment cases. */
  skillDir: string;
  /** Additional independently packaged capability skills exposed for composition. */
  additionalSkillDirs?: string[];
  /** Repo-relative directories the skill is copied into. */
  skillMounts: string[];
  /** Mount every sibling skill of the plugin, not just `skillDir`. */
  mountPluginSkills?: boolean;
  /** Build a Claude plugin from the source plugin instead of project discovery. */
  sourceClaudePlugin?: boolean;
  /** Build a local marketplace for an isolated installed Codex plugin. */
  sourceCodexPlugin?: boolean;
  /** Inject a private skill-load sentinel into mounted eval copies only. */
  activationProbe?: { token: string };
  /** Let claude -p model an already-explicit slash invocation in its mounted copy. */
  claudeExplicitEntrypointBridge?: boolean;
  /** Value of `{{case_dir}}` / `$DARROW_EVAL_CASE_DIR` in `fixture.setup`. */
  caseDir?: string;
}

/** Builds a temp git repo per the fixture and mounts the skill into the given dirs. */
export async function buildFixture(
  options: BuildFixtureOptions,
): Promise<string> {
  const { fixture, skillDir, caseDir = "" } = options;
  const repoDir = await mkdtemp(join(tmpdir(), "darrow-eval-"));
  await initFixtureRepo(repoDir, fixture);
  await applyFixtureContent(repoDir, fixture);
  if (fixture.ticket) await provisionFixtureTicket(repoDir, fixture.ticket);
  if (fixture.setup) await runFixtureSetup(repoDir, fixture.setup, caseDir);

  // Skill-less cases (experiments) mount nothing.
  if (skillDir) await mountSkills(repoDir, options);

  return repoDir;
}

/** Read the bounded private sentinel emitted by mounted activation cases. */
export async function readActivationProbe(
  repoDir: string,
  token: string,
): Promise<SkillActivationObservation> {
  const observedSkills: string[] = [];
  let content: string;
  try {
    content = await readFile(join(repoDir, ACTIVATION_LOG), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return {
      source: "skill_activation_probe",
      complete: code === "ENOENT",
      primarySkill: null,
      observedSkills,
    };
  }
  for (const line of content.split("\n").filter(Boolean)) {
    const fields = line.split("\t");
    if (
      fields.length !== 2 ||
      fields[1] !== token ||
      !/^[A-Za-z0-9._-]+$/.test(fields[0] ?? "")
    ) {
      return {
        source: "skill_activation_probe",
        complete: false,
        primarySkill: null,
        observedSkills: [],
      };
    }
    const skill = fields[0]!;
    if (!observedSkills.includes(skill)) observedSkills.push(skill);
  }
  return {
    source: "skill_activation_probe",
    complete: true,
    primarySkill: observedSkills[0] ?? null,
    observedSkills,
  };
}

export async function destroyFixture(repoDir: string): Promise<void> {
  if (!existsSync(repoDir)) return;
  let removalError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const writable = Bun.spawn(["chmod", "-R", "u+rwX", repoDir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const { err: stderr, code } = await captureProcess(writable);
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
    if (!existsSync(repoDir)) return;
    await Bun.sleep(Math.min(100 * 2 ** attempt, 1_000));
  }
  throw removalError ?? new Error(`cannot remove eval fixture: ${repoDir}`);
}
