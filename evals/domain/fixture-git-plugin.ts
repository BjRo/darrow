const gitPlugin = new URL(
  "../../plugins/capability/darrow-git/",
  import.meta.url,
);

/** Stage the Git plugin's public package as ordinary fixture files. */
export async function gitPluginFixtureFiles() {
  const files: Record<string, string> = {};
  const backend = new URL("backend/", gitPlugin);
  for (const name of ["pyproject.toml", "uv.lock", "scripts/run_locked.py"])
    files[`.fixture-plugin/backend/${name}`] = await Bun.file(
      new URL(name, backend),
    ).text();
  for await (const name of new Bun.Glob("src/**/*.{py,typed,md}").scan(
    backend.pathname,
  ))
    files[`.fixture-plugin/backend/${name}`] = await Bun.file(
      new URL(name, backend),
    ).text();
  for (const manifest of [
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
  ])
    files[`.fixture-plugin/${manifest}`] = await Bun.file(
      new URL(manifest, gitPlugin),
    ).text();
  return files;
}
