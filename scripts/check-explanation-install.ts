import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const pluginName = "darrow-explanation";
const marketplaceName = "explanation-certification";
const source = resolve(import.meta.dir, "../plugins/capability", pluginName);
const skillPath = "skills/explain-visually/SKILL.md";

async function hostCommand(args: string[]): Promise<string[]> {
  const modules = process.env.DARROW_CERT_NPM_ROOT;
  if (!modules) return args;
  const [host, ...rest] = args;
  const packages: Record<string, string> = {
    codex: "@openai/codex",
    claude: "@anthropic-ai/claude-code",
  };
  const name = packages[host!];
  assert(name, `unsupported certification host: ${host}`);
  const root = join(modules, name);
  const manifest = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  const bin =
    typeof manifest.bin === "string" ? manifest.bin : manifest.bin[host!];
  assert.equal(typeof bin, "string", `missing host entrypoint: ${host}`);
  const entry = resolve(root, bin);
  // npm's Windows .cmd shims are not executable via Bun.spawn. Invoke the
  // installed package entrypoint directly, retaining each argument separately.
  return entry.endsWith(".js") ? ["node", entry, ...rest] : [entry, ...rest];
}

async function command(
  args: string[],
  env: Record<string, string>,
  cwd: string,
) {
  const proc = Bun.spawn(await hostCommand(args), {
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  assert.equal(code, 0, `${args.join(" ")}: ${stderr}\n${stdout}`);
  return stdout;
}

async function auditArtifact(root: string): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    assert(
      !entry.isSymbolicLink(),
      `artifact must not depend on symlinks: ${path}`,
    );
    if (entry.isDirectory()) await auditArtifact(path);
    else
      assert(
        /\.(md|json|yaml)$/.test(entry.name) || entry.name === "LICENSE",
        `unexpected executable or dependency in skill-only artifact: ${path}`,
      );
  }
}

async function prepare(root: string) {
  const marketplace = join(root, "marketplace ü with spaces");
  const plugin = join(marketplace, pluginName);
  await cp(source, plugin, { recursive: true });
  await auditArtifact(plugin);
  const claude = JSON.parse(
    await readFile(join(plugin, ".claude-plugin/plugin.json"), "utf8"),
  );
  const codex = JSON.parse(
    await readFile(join(plugin, ".codex-plugin/plugin.json"), "utf8"),
  );
  assert.equal(claude.name, pluginName);
  assert.equal(codex.name, pluginName);
  assert.equal(claude.version, codex.version);
  assert.equal(codex.skills, "./skills/");
  await mkdir(join(marketplace, ".claude-plugin"));
  await writeFile(
    join(marketplace, ".claude-plugin/marketplace.json"),
    JSON.stringify({
      name: marketplaceName,
      owner: { name: "Darrow certification" },
      plugins: [{ name: pluginName, source: `./${pluginName}` }],
    }),
  );
  return { marketplace, plugin };
}

async function verifyInstalled(path: string, plugin: string) {
  assert.equal(
    await readFile(join(path, skillPath), "utf8"),
    await readFile(join(plugin, skillPath), "utf8"),
  );
  await auditArtifact(path);
}

async function installCodex(root: string, marketplace: string, plugin: string) {
  const config = join(root, "codex config ü");
  await mkdir(config);
  const env = { ...process.env, CODEX_HOME: config };
  await command(
    ["codex", "plugin", "marketplace", "add", marketplace, "--json"],
    env,
    root,
  );
  const receipt = JSON.parse(
    await command(
      ["codex", "plugin", "add", `${pluginName}@${marketplaceName}`, "--json"],
      env,
      root,
    ),
  );
  assert.equal(typeof receipt.installedPath, "string");
  await verifyInstalled(receipt.installedPath, plugin);
  console.log(
    `Codex: installed complete skill-only artifact at ${receipt.installedPath}`,
  );
}

async function installClaude(
  root: string,
  marketplace: string,
  plugin: string,
) {
  const config = join(root, "claude config ü");
  await mkdir(config);
  const env = { ...process.env, CLAUDE_CONFIG_DIR: config };
  await command(["claude", "plugin", "validate", plugin], env, root);
  await command(
    ["claude", "plugin", "marketplace", "add", marketplace],
    env,
    root,
  );
  await command(
    ["claude", "plugin", "install", `${pluginName}@${marketplaceName}`],
    env,
    root,
  );
  const list = JSON.parse(
    await command(["claude", "plugin", "list", "--json"], env, root),
  );
  const installed = list.find(
    (entry: { id: string }) => entry.id === `${pluginName}@${marketplaceName}`,
  );
  assert(installed?.enabled, "Claude plugin must be enabled");
  await verifyInstalled(installed.installPath, plugin);
  const details = await command(
    ["claude", "plugin", "details", `${pluginName}@${marketplaceName}`],
    env,
    root,
  );
  assert.match(details, /explain-visually/);
  console.log(
    `Claude: installed and discovered explain-visually at ${installed.installPath}`,
  );
}

const root = await mkdtemp(join(tmpdir(), "darrow explanation ü "));
try {
  const { marketplace, plugin } = await prepare(root);
  await installCodex(root, marketplace, plugin);
  await installClaude(root, marketplace, plugin);
  console.log(
    `${process.platform}: fresh installation passed; live model invocation is a separate check`,
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
