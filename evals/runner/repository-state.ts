async function gitOutput(
  repoDir: string,
  args: string[],
  acceptedCodes = [0],
): Promise<{ output: string; code: number }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, error, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (!acceptedCodes.includes(code)) {
    throw new Error(`cannot inspect fixture repository: ${error.trim()}`);
  }
  return { output, code };
}

export function repositoryMutationMatches(
  before: string,
  after: string,
  expectedChange: boolean,
): boolean {
  return expectedChange ? before !== after : before === after;
}

/** Capture branch, all refs, index, tracked files, and untracked files. */
export async function repositoryMutationState(
  repoDir: string,
): Promise<string> {
  const [status, branch, refs] = await Promise.all([
    gitOutput(repoDir, ["status", "--porcelain=v1", "--untracked-files=all"]),
    gitOutput(repoDir, ["symbolic-ref", "--quiet", "--short", "HEAD"], [0, 1]),
    gitOutput(repoDir, ["for-each-ref", "--format=%(refname)%00%(objectname)"]),
  ]);
  return JSON.stringify({
    branch: branch.code === 0 ? branch.output.trim() : null,
    refs: refs.output,
    status: status.output,
  });
}
