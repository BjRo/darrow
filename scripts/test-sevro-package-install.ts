import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const archive = process.env.SEVRO_PACKAGE_TARBALL;
if (!archive || !isAbsolute(archive) || !existsSync(archive))
  throw new Error(
    "SEVRO_PACKAGE_TARBALL must name an absolute package tarball",
  );

const projectRoot = resolve(import.meta.dir, "..");
const consumer = await mkdtemp(join(tmpdir(), "darrow-sevro-package-"));

async function run(
  argv: string[],
  cwd: string,
  env: Record<string, string | undefined> = process.env,
) {
  const child = Bun.spawn(argv, { cwd, env, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0)
    throw new Error(`${argv[0]} exited ${code}: ${stderr || stdout}`);
  return { stdout, stderr };
}

try {
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ name: "darrow-sevro-install-test", private: true }),
  );
  await run([process.execPath, "add", archive], consumer);
  const installed = join(consumer, "node_modules", "@bjoernrochel", "sevro");
  const command = join(
    consumer,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "sevro.cmd" : "sevro",
  );
  if (!existsSync(command) || existsSync(join(installed, ".git")))
    throw new Error(
      "installed Sevro command is missing or contains Git metadata",
    );
  const manifest = JSON.parse(
    await readFile(join(installed, "package.json"), "utf8"),
  ) as { name: string; version: string };
  if (manifest.name !== "@bjoernrochel/sevro")
    throw new Error("installed package is not Sevro");
  const env: Record<string, string | undefined> = {
    ...process.env,
    SEVRO_PACKAGE_BIN: command,
  };
  delete env.SEVRO_CHECKOUT;
  const result = await run(
    [process.execPath, "test", "evals/runner/parity", "evals/domain"],
    projectRoot,
    env,
  );
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.stdout.write(
    `Darrow parity passed with installed Sevro ${manifest.version}\n`,
  );
} finally {
  await rm(consumer, { recursive: true, force: true });
}
