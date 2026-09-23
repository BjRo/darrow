import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { codexAgentConcurrency } from "./codex-config";

type Harness = "claude" | "codex";

/** Checks need fixture tools, not the candidate harness's authentication. */
export async function isolatedCheckEnvironment(
  repoDir: string,
  stateRoot: string,
  explicit: Record<string, string>,
): Promise<Record<string, string>> {
  const home = join(stateRoot, "home");
  const temp = join(stateRoot, "tmp");
  await Promise.all(
    [home, temp].map((path) => mkdir(path, { recursive: true })),
  );
  const inherited = Object.fromEntries(
    ["LANG", "LC_ALL", "TERM"].flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]!]],
    ),
  );
  return {
    ...inherited,
    ...explicit,
    PATH: `${join(repoDir, ".git", "fixture-bin")}:${process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin"}`,
    HOME: home,
    TMPDIR: temp,
    ZDOTDIR: home,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

const ALLOWED_ENVIRONMENT = [
  "PATH",
  "LANG",
  "LC_ALL",
  "TERM",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
];

async function copyCodexCredentials(configRoot: string): Promise<void> {
  if (process.env.OPENAI_API_KEY) return;
  const source = resolve(
    process.env.CODEX_HOME ?? resolve(process.env.HOME ?? "", ".codex"),
    "auth.json",
  );
  if (!(await Bun.file(source).exists())) return;
  const target = resolve(configRoot, "auth.json");
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target);
}

/** Read the Claude Code credential out of the macOS keychain, or null when the
 * keychain has no usable entry. */
async function keychainClaudeCredential(): Promise<string | null> {
  const account = process.env.USER ?? process.env.LOGNAME;
  const argv = [
    "/usr/bin/security",
    "find-generic-password",
    "-s",
    "Claude Code-credentials",
    ...(account ? ["-a", account] : []),
    "-w",
  ];
  const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe" });
  const [credential, code] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  if (code !== 0 || !credential.trim()) return null;
  return credential;
}

async function copyClaudeCredentials(configRoot: string): Promise<void> {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY)
    return;
  const source = resolve(
    process.env.CLAUDE_CONFIG_DIR ?? resolve(process.env.HOME ?? "", ".claude"),
    ".credentials.json",
  );
  const target = resolve(configRoot, ".credentials.json");
  if (await Bun.file(source).exists()) {
    await cp(source, target);
    return;
  }
  if (process.platform !== "darwin") return;

  const credential = await keychainClaudeCredential();
  if (credential) {
    await writeFile(target, credential, { mode: 0o600 });
  }
}

/** Build a private home with auth and the explicit repository concurrency
 * limit, excluding user rules, settings, plugins, hooks, and caches. */
export async function isolatedHarnessEnvironment(
  harness: Harness,
  repoDir: string,
): Promise<Record<string, string>> {
  const stateRoot = join(repoDir, ".git", "darrow-eval", "state", harness);
  const configRoot = join(stateRoot, "config");
  const shellRoot = join(stateRoot, "shell");
  const tempRoot = join(stateRoot, "tmp");
  await mkdir(configRoot, { recursive: true });
  await mkdir(shellRoot, { recursive: true });
  await mkdir(tempRoot, { recursive: true });

  if (harness === "codex") {
    const limit = codexAgentConcurrency();
    if (limit !== null) {
      await writeFile(
        join(configRoot, "config.toml"),
        `[agents]\nmax_concurrent_threads_per_session = ${limit}\n`,
        { mode: 0o600 },
      );
    }
  }

  // Codex and Claude may execute tools through `zsh -lc`; macOS path_helper
  // rewrites PATH for login shells. Re-prepend fixture mocks after that system
  // startup so evals cannot fall through to real network tools.
  const fixtureBin = join(repoDir, ".git", "fixture-bin");
  await writeFile(
    join(shellRoot, ".zprofile"),
    `export PATH=${shellQuote(fixtureBin)}:"$PATH"\n`,
    { mode: 0o600 },
  );

  // Goal-loop evals may pin a child to the other harness. Provision both
  // auth channels while keeping settings, hooks, plugins, and caches isolated.
  await Promise.all([
    copyCodexCredentials(configRoot),
    copyClaudeCredentials(configRoot),
  ]);

  const env = Object.fromEntries(
    ALLOWED_ENVIRONMENT.flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]!]],
    ),
  );
  env.HOME = stateRoot;
  env.TMPDIR = tempRoot;
  // Installed plugin sources live in the protected host config tree. Runtime
  // environments belong in writable, per-trial scratch, outside that tree.
  // Each bootstrap derives a distinct environment from its locked backend.
  env.DARROW_CACHE_DIR = join(tempRoot, "darrow-cache");
  env.UV_CACHE_DIR = join(tempRoot, "uv-cache");
  env.ZDOTDIR = shellRoot;
  // The runner wraps the evaluated agent in sandboxedAgentCommand. Nested
  // adaptive-delivery-preflight mechanics must reuse that boundary instead of attempting an
  // unsupported second sandbox-exec layer.
  env.DARROW_ADAPTIVE_DELIVERY_EXTERNAL_SANDBOX = "1";
  env.CODEX_HOME = configRoot;
  env.CLAUDE_CONFIG_DIR = configRoot;
  return env;
}
