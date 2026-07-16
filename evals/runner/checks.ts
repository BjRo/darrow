import type { Check, CheckResult } from "./types";

export async function runChecks(
  repoDir: string,
  checks: Check[],
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    const proc = Bun.spawn(["sh", "-c", check.run], {
      cwd: repoDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    const expectedCode = check.exit_code ?? 0;
    let passed = code === expectedCode;
    let detail = `exit=${code}`;

    const flags = "m" + (check.flags ?? "");
    if (passed && check.expect_regex !== undefined) {
      passed = new RegExp(check.expect_regex, flags).test(out);
      if (!passed)
        detail = `expect_regex /${check.expect_regex}/ missed:\n${out.trim()}`;
    }
    if (passed && check.not_regex !== undefined) {
      passed = !new RegExp(check.not_regex, flags).test(out);
      if (!passed)
        detail = `not_regex /${check.not_regex}/ matched:\n${out.trim()}`;
    }
    if (code !== expectedCode)
      detail = `exit=${code} (expected ${expectedCode}): ${err.trim()}`;

    results.push({ name: check.name, passed, detail: passed ? "ok" : detail });
  }
  return results;
}
