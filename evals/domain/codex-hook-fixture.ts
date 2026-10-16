/** Exercise installed native hook commands without importing Sevro internals. */
export const CODEX_SKILL_HOOK_FIXTURE = `
async function skillHook(event, session, details = {}) {
  const settings = await Bun.file(process.env.CODEX_HOME + "/hooks.json").json();
  const groups = settings.hooks[event];
  if (!Array.isArray(groups) || !groups.length) throw new Error("Missing native hook: " + event);
  for (const group of groups) for (const handler of group.hooks) {
    if (handler.type !== "command") throw new Error("Unsupported fixture hook");
    const child = Bun.spawn(["/bin/sh", "-c", handler.command], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    child.stdin.write(JSON.stringify({ hook_event_name: event, session_id: session, turn_id: "fixture-turn", ...details }));
    child.stdin.end();
    const [code, , stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    if (code !== 0) throw new Error("Native hook failed: " + stderr);
  }
}
`;
