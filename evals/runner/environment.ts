import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

type Harness = "claude" | "codex";

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

async function copyClaudeCredentials(configRoot: string): Promise<void> {
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return;
  }

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
  if (code === 0 && credential.trim()) {
    await writeFile(target, credential, { mode: 0o600 });
  }
}

/** Build an auth-only, private home so user rules, plugins, hooks, and caches
 * cannot influence the evaluated harness. */
export async function isolatedHarnessEnvironment(
  harness: Harness,
  repoDir: string,
): Promise<Record<string, string>> {
  const stateRoot = join(repoDir, ".git", "darrow-eval", "state", harness);
  const configRoot = join(stateRoot, "config");
  const tempRoot = join(stateRoot, "tmp");
  await mkdir(configRoot, { recursive: true });
  await mkdir(tempRoot, { recursive: true });

  if (harness === "codex") {
    const source = resolve(
      process.env.CODEX_HOME ?? resolve(process.env.HOME ?? "", ".codex"),
      "auth.json",
    );
    if (await Bun.file(source).exists()) {
      const target = resolve(configRoot, "auth.json");
      await mkdir(dirname(target), { recursive: true });
      await cp(source, target);
    }
  } else {
    await copyClaudeCredentials(configRoot);
  }

  const env = Object.fromEntries(
    ALLOWED_ENVIRONMENT.flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]!]],
    ),
  );
  env.HOME = stateRoot;
  env.TMPDIR = tempRoot;
  if (harness === "codex") env.CODEX_HOME = configRoot;
  else env.CLAUDE_CONFIG_DIR = configRoot;
  return env;
}
