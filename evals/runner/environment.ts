import { chmod, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

type Harness = "claude" | "codex";

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

interface ClaudeOAuthCredential {
  token: string;
  serialized: string;
}

function claudeOAuthCredential(
  credential: string,
  source: string,
): ClaudeOAuthCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(credential);
  } catch {
    throw new Error(`cannot parse Claude credentials from ${source}`);
  }
  const oauth = (parsed as { claudeAiOauth?: Record<string, unknown> })
    .claudeAiOauth;
  const token = oauth?.accessToken;
  if (typeof token !== "string" || !token.trim()) {
    throw new Error(`Claude credentials from ${source} have no access token`);
  }
  return {
    token,
    // Discard unrelated MCP OAuth entries from the user's credential record.
    serialized: JSON.stringify({ claudeAiOauth: oauth }),
  };
}

async function isolatedClaudeOAuthCredential(): Promise<ClaudeOAuthCredential | null> {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY)
    return null;
  const source = resolve(
    process.env.CLAUDE_CONFIG_DIR ?? resolve(process.env.HOME ?? "", ".claude"),
    ".credentials.json",
  );
  if (await Bun.file(source).exists()) {
    return claudeOAuthCredential(await readFile(source, "utf8"), source);
  }
  if (process.platform !== "darwin") return null;

  const credential = await keychainClaudeCredential();
  return credential
    ? claudeOAuthCredential(credential, "the macOS Claude Code keychain entry")
    : null;
}

async function installIsolatedSecurityShim(
  fixtureBin: string,
  credential: ClaudeOAuthCredential | null,
  stateRoot: string,
): Promise<void> {
  const credentialPath = join(stateRoot, "claude-credentials.json");
  if (credential) {
    await writeFile(credentialPath, credential.serialized, { mode: 0o600 });
  }
  const shim = join(fixtureBin, "security");
  await writeFile(
    shim,
    [
      "#!/bin/sh",
      'case " $* " in',
      '  *" find-generic-password "*" Claude Code-credentials "*)',
      credential
        ? `    exec /bin/cat ${shellQuote(credentialPath)}`
        : "    exit 44",
      "    ;;",
      '  *" add-generic-password "*" Claude Code-credentials "*) exit 0 ;;',
      "  *) exit 44 ;;",
      "esac",
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  await chmod(shim, 0o700);
}

/** Build an auth-only, private home so user rules, plugins, hooks, and caches
 * cannot influence the evaluated harness. */
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
  const [, claudeCredential] = await Promise.all([
    copyCodexCredentials(configRoot),
    isolatedClaudeOAuthCredential(),
  ]);
  await mkdir(fixtureBin, { recursive: true });
  await installIsolatedSecurityShim(fixtureBin, claudeCredential, stateRoot);

  const env = Object.fromEntries(
    ALLOWED_ENVIRONMENT.flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]!]],
    ),
  );
  env.HOME = stateRoot;
  env.TMPDIR = tempRoot;
  env.ZDOTDIR = shellRoot;
  // The runner wraps the evaluated agent in sandboxedAgentCommand. Nested
  // goal-loop mechanics must reuse that boundary instead of attempting an
  // unsupported second sandbox-exec layer.
  env.DARROW_GOAL_LOOP_EXTERNAL_SANDBOX = "1";
  env.CODEX_HOME = configRoot;
  env.CLAUDE_CONFIG_DIR = configRoot;
  if (claudeCredential) env.CLAUDE_CODE_OAUTH_TOKEN = claudeCredential.token;
  // Real forge credentials and interactive Git helpers never enter a fixture.
  env.GH_CONFIG_DIR = join(configRoot, "gh");
  env.GLAB_CONFIG_DIR = join(configRoot, "glab");
  env.GIT_CONFIG_GLOBAL = "/dev/null";
  env.GIT_CONFIG_SYSTEM = "/dev/null";
  env.GIT_TERMINAL_PROMPT = "0";
  env.GCM_INTERACTIVE = "never";
  env.GIT_ASKPASS = "/usr/bin/false";
  env.SSH_ASKPASS = "/usr/bin/false";
  env.GIT_SSH_COMMAND = "/usr/bin/false";
  return env;
}
