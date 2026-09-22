import { readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import MarkdownIt from "markdown-it";
import GithubSlugger from "github-slugger";
import { parse as parseYaml } from "yaml";

interface Link {
  target: string;
  line: number;
}
interface Page {
  path: string;
  text: string;
  headings: string[];
  anchors: Set<string>;
  links: Link[];
}
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    root: { type: "string", default: process.cwd() },
    external: { type: "boolean", default: false },
  },
});
const root = resolve(values.root!);
const markdown = new MarkdownIt({ html: true });
type Token = ReturnType<typeof markdown.parse>[number];
const errors: string[] = [];
const external = new Map<string, string>();
const pages = new Map<string, Page>();
const skip = new Set([
  ".git",
  "node_modules",
  ".worktrees",
  ".tmp",
  "results",
  "cache",
  "fixtures",
]);
function fail(path: string, message: string, line = 1) {
  errors.push(`${path}:${line}: ${message}`);
}
async function filesBelow(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesBelow(path)));
    else if (
      entry.isFile() &&
      entry.name.endsWith(".md") &&
      !entry.name.endsWith(".template.md")
    )
      files.push(path);
  }
  return files;
}
async function allFilesBelow(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (skip.has(entry.name) && entry.name !== "fixtures") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await allFilesBelow(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
function attributes(tag: string): Map<string, string> {
  return new Map(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(
      (match) => [
        match[1]!.toLowerCase(),
        match[2] ?? match[3] ?? match[4] ?? "",
      ],
    ),
  );
}
function visible(tokens: Token[]): string {
  return tokens
    .map((token) => (token.type === "html_inline" ? "" : token.content))
    .join("");
}
function inspectHtml(page: Page, html: string, line: number) {
  for (const match of html.matchAll(/<(?:a|img|svg|h[1-6])\b[^>]*>/gi)) {
    const tag = match[0];
    const attrs = attributes(tag);
    for (const key of ["id", "name"])
      if (attrs.get(key)) page.anchors.add(attrs.get(key)!);
    if (/^<img\b/i.test(tag) && !attrs.get("alt")?.trim())
      fail(page.path, "missing image alternative", line);
    for (const key of ["src", "href"])
      if (attrs.get(key)) page.links.push({ target: attrs.get(key)!, line });
  }
}
function inspectInlineToken(page: Page, token: Token, line: number) {
  if (token.type === "link_open")
    page.links.push({ target: String(token.attrGet("href") ?? ""), line });
  if (token.type === "image") {
    if (!token.content.trim())
      fail(page.path, "missing image alternative", line);
    page.links.push({ target: String(token.attrGet("src") ?? ""), line });
  }
  if (token.type === "html_block" || token.type === "html_inline")
    inspectHtml(page, token.content, line);
  if (token.children) inspectTokens(page, token.children, line);
}
function inspectTokens(page: Page, tokens: Token[], inheritedLine = 1) {
  const slugger = new GithubSlugger();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const line = token.map ? token.map[0] + 1 : inheritedLine;
    if (token.type === "heading_open") {
      const heading = visible(tokens[i + 1]?.children ?? []);
      page.headings.push(heading);
      page.anchors.add(slugger.slug(heading));
    }
    if (token.type === "fence" && !token.info.trim())
      fail(page.path, "missing fence language", line);
    inspectInlineToken(page, token, line);
  }
}
for (const path of await filesBelow(root)) {
  const text = await readFile(path, "utf8");
  const page: Page = {
    path,
    text,
    headings: [],
    anchors: new Set(),
    links: [],
  };
  // GitHub renders frontmatter as metadata, not Markdown headings.
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, (frontmatter) =>
    frontmatter.replace(/[^\n]/g, ""),
  );
  inspectTokens(page, markdown.parse(body, {}));
  pages.set(path, page);
}
function localDestination(page: Page, decoded: string) {
  const hash = decoded.indexOf("#");
  const anchor = hash < 0 ? undefined : decoded.slice(hash + 1);
  const name = (hash < 0 ? decoded : decoded.slice(0, hash)).split("?")[0]!;
  const path = name
    ? resolve(
        name.startsWith("/") ? root : dirname(page.path),
        name.replace(/^\//, ""),
      )
    : page.path;
  return { path, anchor };
}
function verifyAnchor(
  page: Page,
  link: Link,
  destination: string,
  anchor?: string,
) {
  if (!anchor) return;
  const target = pages.get(destination);
  if (target && !target.anchors.has(anchor))
    fail(page.path, `missing heading anchor: ${link.target}`, link.line);
  else if (!target && destination.endsWith(".md"))
    fail(page.path, `cannot verify heading anchor: ${link.target}`, link.line);
}
async function verifyDestination(
  page: Page,
  link: Link,
  path: string,
  anchor?: string,
) {
  const { target, line } = link;
  if (path !== root && !path.startsWith(root + sep)) {
    fail(page.path, `link leaves repository: ${target}`, line);
    return;
  }
  let destination = path;
  try {
    if ((await stat(path)).isDirectory()) {
      destination = join(path, "README.md");
      if (!anchor) return;
    }
    verifyAnchor(page, link, destination, anchor);
  } catch {
    fail(page.path, `missing internal link: ${target}`, line);
  }
}
async function inspectLink(page: Page, link: Link) {
  const { target, line } = link;
  if (!target) {
    fail(page.path, "empty link destination", line);
    return;
  }
  if (/^https?:\/\//i.test(target)) {
    external.set(target, page.path);
    return;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(target)) return;
  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    fail(page.path, `invalid URL escape: ${target}`, line);
    return;
  }
  const { path, anchor } = localDestination(page, decoded);
  await verifyDestination(page, link, path, anchor);
}
for (const page of pages.values())
  for (const link of page.links) await inspectLink(page, link);
async function json(
  path: string,
): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    fail(path, "unreadable or invalid JSON");
    return undefined;
  }
}
const marketplacePath = join(root, ".claude-plugin/marketplace.json");
const marketplace = await json(marketplacePath);
const catalog = pages.get(join(root, "docs/choosing-plugins.md"));
if (!catalog)
  fail(join(root, "docs/choosing-plugins.md"), "missing plugin catalog");
const pluginRoots = new Set<string>();
const names = new Set<string>();
async function verifySkillDirectory(plugin: string) {
  const directory = join(plugin, "skills");
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const skills = entries.filter((entry) => entry.isDirectory());
    if (!skills.length) fail(directory, "manifest skill directory is empty");
    for (const skill of skills)
      await readFile(join(directory, skill.name, "SKILL.md"), "utf8");
  } catch {
    fail(directory, "manifest references missing or unreadable skill files");
  }
}
if (!Array.isArray(marketplace?.plugins))
  fail(marketplacePath, "plugins must be an array");
else
  for (const entry of marketplace.plugins as Array<{
    name?: string;
    source?: string;
  }>) {
    if (
      !entry.name ||
      !entry.source ||
      !/^\.\/plugins\/[^/]+\/[^/]+$/.test(entry.source)
    ) {
      fail(marketplacePath, "invalid local plugin reference");
      continue;
    }
    const plugin = resolve(root, entry.source);
    if (names.has(entry.name) || pluginRoots.has(plugin))
      fail(marketplacePath, `duplicate plugin reference: ${entry.name}`);
    names.add(entry.name);
    pluginRoots.add(plugin);
    const claude = await json(join(plugin, ".claude-plugin/plugin.json"));
    const codex = await json(join(plugin, ".codex-plugin/plugin.json"));
    if (
      claude?.name !== entry.name ||
      codex?.name !== entry.name ||
      basename(plugin) !== entry.name
    )
      fail(plugin, "manifest identity differs from marketplace");
    if (
      typeof claude?.version !== "string" ||
      !/^\d+\.\d+\.\d+$/.test(claude.version) ||
      claude.version !== codex?.version
    )
      fail(plugin, "manifest versions must be identical semantic versions");
    if (codex?.skills !== "./skills/")
      fail(plugin, "Codex manifest must point at ./skills/");
    await verifySkillDirectory(plugin);
    const readme = pages.get(join(plugin, "README.md"));
    const required = [
      "When to use",
      "Hosts and prerequisites",
      "Installation",
      "Usage",
      "Expected result",
      "Troubleshooting",
      "License",
    ];
    for (const heading of required)
      if (!readme?.headings.includes(heading))
        fail(join(plugin, "README.md"), `missing README section: ${heading}`);
    if (
      !readme?.headings.some((heading) =>
        [
          "Design boundaries",
          "Design model and boundaries",
          "Privacy and security",
          "Safety boundaries",
        ].includes(heading),
      )
    )
      fail(join(plugin, "README.md"), "missing README safety section");
    if (
      !catalog?.links.some(
        ({ target }) =>
          resolve(dirname(catalog.path), target.split("#")[0]!) ===
          join(plugin, "README.md"),
      )
    )
      fail(plugin, "plugin is absent from the catalog");
  }
for (const page of pages.values()) {
  if (
    /^plugins\/[^/]+\/[^/]+\/README\.md$/.test(relative(root, page.path)) &&
    !pluginRoots.has(dirname(page.path))
  )
    fail(page.path, "plugin README is absent from marketplace");
}

function installedReadmeSurface(text: string): string {
  let ignored = false;
  return text
    .split("\n")
    .filter((line) => {
      const heading = /^##\s+(.+)$/.exec(line)?.[1];
      if (heading)
        ignored = /^(?:Development|Tests?|Contributing)\b/i.test(heading);
      return !ignored;
    })
    .join("\n");
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function isHookPath(relativePath: string): boolean {
  return (
    relativePath.includes(`${sep}hooks${sep}`) ||
    relativePath.endsWith(`${sep}.claude-plugin${sep}hooks.json`)
  );
}

function isModelFacingPath(relativePath: string): boolean {
  if (
    relativePath.endsWith(`${sep}SKILL.md`) ||
    relativePath.endsWith(".fixture.md")
  )
    return true;
  return (
    relativePath.includes(`${sep}skills${sep}`) &&
    relativePath.includes(`${sep}references${sep}`) &&
    relativePath.endsWith(".md")
  );
}

function verifyHookLauncher(path: string, surface: string, hook: boolean) {
  if (!hook || !/\buv\b|\$uv\.Path/i.test(surface)) return;
  if (!surface.includes("scripts/run_locked.py"))
    fail(path, "runtime hook bypasses backend/scripts/run_locked.py");
}

function verifyRuntimeCommands(path: string, text: string) {
  const relativePath = relative(root, path);
  const hook = isHookPath(relativePath);
  const modelFacing = isModelFacingPath(relativePath);
  const readme =
    basename(path) === "README.md" && pluginRoots.has(dirname(path));
  if (!hook && !modelFacing && !readme) return;
  const surface = readme ? installedReadmeSurface(text) : text;
  const commands = surface.matchAll(/uv\s+run\b(?:(?!\n\s*\n)[\s\S]){0,500}/g);
  for (const command of commands) {
    if (!command[0].includes("scripts/run_locked.py"))
      fail(
        path,
        "installed runtime command bypasses backend/scripts/run_locked.py",
        lineAt(surface, command.index),
      );
  }
  verifyHookLauncher(path, surface, hook);
}

function verifyGeneratedRuntimeCommands(path: string, text: string) {
  const uvRunArgumentLists = text.matchAll(
    /(?:["']uv["']|\buv)\s*,\s*["']run["'][\s\S]*?\]/g,
  );
  for (const command of uvRunArgumentLists) {
    if (!command[0].includes("scripts/run_locked.py"))
      fail(
        path,
        "generated runtime command bypasses backend/scripts/run_locked.py",
        lineAt(text, command.index),
      );
  }
}

async function pythonPackages(inventoryPath: string): Promise<string[]> {
  try {
    return (await readFile(inventoryPath, "utf8"))
      .split("\n")
      .map((line) => line.replace(/\s*#.*$/, "").trim())
      .filter(Boolean);
  } catch {
    fail(inventoryPath, "missing Python package inventory");
    return [];
  }
}

function owningPlugin(backend: string): string | undefined {
  return [...pluginRoots]
    .sort((left, right) => right.length - left.length)
    .find((candidate) => backend.startsWith(candidate + sep));
}

async function verifyLauncherCopies(
  packages: string[],
  inventoryPath: string,
): Promise<void> {
  let canonical: { path: string; text: string } | undefined;
  for (const packagePath of packages) {
    const backend = resolve(root, packagePath);
    if (!owningPlugin(backend)) {
      fail(
        inventoryPath,
        `registered backend has no marketplace plugin: ${packagePath}`,
      );
      continue;
    }
    const launcher = join(backend, "scripts/run_locked.py");
    try {
      const text = await readFile(launcher, "utf8");
      if (!canonical) canonical = { path: launcher, text };
      else if (text !== canonical.text)
        fail(launcher, `runtime launcher differs from ${canonical.path}`);
    } catch {
      fail(launcher, "registered backend lacks a readable runtime launcher");
    }
  }
}

type RuntimeSurface = "commands" | "generated";

function ignoredRuntimeSurface(relativePath: string): boolean {
  return (
    relativePath.includes(`${sep}evals${sep}`) ||
    relativePath.includes(`${sep}tests${sep}`)
  );
}

function productionPythonSurface(relativePath: string): boolean {
  return (
    (relativePath.startsWith(`backend${sep}src${sep}`) ||
      relativePath.includes(`${sep}backend${sep}src${sep}`)) &&
    relativePath.endsWith(".py")
  );
}

function runtimeCommandSurface(relativePath: string, path: string): boolean {
  return (
    basename(path) === "README.md" ||
    basename(path) === "SKILL.md" ||
    relativePath.includes(`${sep}references${sep}`) ||
    relativePath.includes(`${sep}hooks${sep}`) ||
    relativePath === join(".claude-plugin", "hooks.json")
  );
}

function runtimeSurface(
  plugin: string,
  path: string,
): RuntimeSurface | undefined {
  const relativePath = relative(plugin, path);
  if (relativePath.endsWith(".fixture.md")) return "commands";
  if (ignoredRuntimeSurface(relativePath)) return;
  if (productionPythonSurface(relativePath)) return "generated";
  if (runtimeCommandSurface(relativePath, path)) return "commands";
}

async function verifyPluginRuntimeSurfaces(plugin: string): Promise<void> {
  for (const path of await allFilesBelow(plugin)) {
    const surface = runtimeSurface(plugin, path);
    if (!surface) continue;
    try {
      const text = await readFile(path, "utf8");
      if (surface === "generated") verifyGeneratedRuntimeCommands(path, text);
      else verifyRuntimeCommands(path, text);
    } catch {
      fail(path, "runtime command surface is unreadable");
    }
  }
}

async function verifyPythonRuntimeLaunchers() {
  const inventoryPath = join(root, "python-packages.txt");
  await verifyLauncherCopies(
    await pythonPackages(inventoryPath),
    inventoryPath,
  );
  for (const plugin of pluginRoots) {
    await verifyPluginRuntimeSurfaces(plugin);
  }
}

await verifyPythonRuntimeLaunchers();
for (const resource of ["SKILL.md", "scripts/find-plugin-claim.sh"]) {
  const canonical = join(root, ".agents/skills/darrow-guide", resource);
  const mirror = join(root, ".claude/skills/darrow-guide", resource);
  try {
    if (
      (await readFile(canonical, "utf8")) !== (await readFile(mirror, "utf8"))
    )
      fail(
        mirror,
        resource === "SKILL.md"
          ? "guide entrypoints differ"
          : `guide resources differ: ${resource}`,
      );
  } catch {
    fail(canonical, `both guide copies are required: ${resource}`);
  }
}

interface GuideQuestion {
  id: string;
  sources: string[];
  static_page: string;
}
async function verifyGuideQuestion(
  question: GuideQuestion,
  directory: string,
  inventoryPath: string,
) {
  try {
    const evalCase = parseYaml(
      await readFile(join(directory, question.id + ".yaml"), "utf8"),
    );
    if (evalCase.id !== question.id)
      fail(inventoryPath, `case ID differs: ${question.id}`);
  } catch {
    fail(inventoryPath, `missing or invalid case: ${question.id}`);
  }
  for (const target of [...(question.sources ?? []), question.static_page]) {
    if (typeof target !== "string") {
      fail(inventoryPath, `missing route: ${question.id}`);
      continue;
    }
    await inspectLink({ path: inventoryPath } as Page, {
      target: relative(directory, join(root, target)),
      line: 1,
    });
  }
}
async function verifyListedCases(
  directory: string,
  inventoryPath: string,
  ids: Set<string>,
) {
  try {
    for (const file of await readdir(directory))
      if (file.endsWith(".yaml") && !ids.has(file.slice(0, -5)))
        fail(inventoryPath, `case absent from inventory: ${file}`);
  } catch {
    fail(inventoryPath, "unreadable case directory");
  }
}
async function verifyGuideInventory() {
  const directory = join(root, ".agents/skills/darrow-guide/evals");
  const inventoryPath = join(directory, "inventory.json");
  const inventory = await json(inventoryPath);
  if (
    !Number.isInteger(inventory?.version) ||
    Number(inventory?.version) < 1 ||
    !Array.isArray(inventory?.questions)
  ) {
    fail(inventoryPath, "invalid versioned question inventory");
    return;
  }
  const ids = new Set<string>();
  for (const question of inventory.questions as GuideQuestion[]) {
    if (!/^guide-[a-z-]+$/.test(question.id) || ids.has(question.id)) {
      fail(inventoryPath, "invalid or duplicate question ID");
      continue;
    }
    ids.add(question.id);
    await verifyGuideQuestion(question, directory, inventoryPath);
  }
  await verifyListedCases(directory, inventoryPath, ids);
}
await verifyGuideInventory();

async function checkExternalUrl(url: string): Promise<string> {
  let error = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      await response.body?.cancel();
      if (response.ok) return "";
      error = `HTTP ${response.status}`;
      if (response.status !== 429 && response.status < 500) return error;
    } catch (cause) {
      error = String(cause);
    }
    if (attempt < 2) await Bun.sleep(1000 * (attempt + 1));
  }
  return error;
}
if (values.external) {
  // Network checks are deliberately a separate mode and never replace local gates.
  for (const [url, page] of external) {
    const error = await checkExternalUrl(url);
    if (error)
      console.error(`${page}: external link needs triage: ${url} (${error})`);
    if (error) process.exitCode = 1;
  }
  console.log(
    `Checked ${external.size} external URLs separately from local validation.`,
  );
} else {
  for (const error of errors) console.error(error);
  console.log(
    `Checked ${pages.size} Markdown pages, ${pluginRoots.size} plugins, Python runtime launchers, and both guide entrypoints.`,
  );
  if (errors.length) process.exitCode = 1;
}
