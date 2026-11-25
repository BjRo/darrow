type Row = Record<string, unknown>;

function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("missing event object");
  return value as Row;
}

function codexTurn(
  type: unknown,
  state: { started: number; completed: number },
) {
  if (type === "turn.failed") throw new Error("failed turn");
  if (type === "turn.started") {
    if (state.started !== state.completed) throw new Error("overlapping turns");
    state.started++;
  }
  if (type === "turn.completed") {
    if (state.started !== state.completed + 1)
      throw new Error("unbound completion");
    state.completed++;
  }
}

function codexCommands(events: Row[]): string[] {
  const state = { started: 0, completed: 0 };
  const commands: string[] = [];
  for (const event of events) {
    codexTurn(event.type, state);
    if (
      !["item.started", "item.updated", "item.completed"].includes(
        String(event.type),
      )
    )
      continue;
    const item = row(event.item);
    if (item.type !== "command_execution") continue;
    if (state.started !== state.completed + 1)
      throw new Error("command outside turn");
    commands.push(command(item.command));
  }
  if (state.started === 0 || state.started !== state.completed)
    throw new Error("incomplete turn");
  return commands;
}

function command(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error("missing command");
  return value;
}

function claudeSession(events: Row[]): string {
  const starts = events.filter(
    (event) => event.type === "system" && event.subtype === "init",
  );
  if (starts.length !== 1 || starts[0] !== events[0])
    throw new Error("unbound Claude session");
  return command(starts[0]!.session_id);
}

function claudeComplete(events: Row[]) {
  const session = claudeSession(events);
  const results = events.filter((event) => event.type === "result");
  if (
    results.length !== 1 ||
    results[0] !== events.at(-1) ||
    results[0]!.session_id !== session ||
    results[0]!.subtype !== "success" ||
    results[0]!.is_error !== false
  )
    throw new Error("incomplete Claude result");
}

function claudeCommands(events: Row[]): string[] {
  claudeComplete(events);
  const commands: string[] = [];
  for (const event of events) {
    if (event.type !== "assistant") continue;
    const content = row(event.message).content;
    if (!Array.isArray(content)) throw new Error("missing assistant content");
    for (const value of content) {
      const block = row(value);
      if (block.type === "tool_use" && block.name === "Bash")
        commands.push(command(row(block.input).command));
    }
  }
  return commands;
}

/** Grade command text only; skill bodies and final answers cannot prove execution. */
export function commandAbsence(
  text: string | null,
  eventId: string,
  terms: string[],
): "passed" | "failed" | "unavailable" {
  if (text === null) return "unavailable";
  try {
    const events = text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => row(JSON.parse(line)));
    if (events.some((event) => typeof event.type !== "string"))
      return "unavailable";
    const commands =
      eventId === "sevro.codex.events"
        ? codexCommands(events)
        : eventId === "sevro.claude.events"
          ? claudeCommands(events)
          : null;
    if (commands === null) return "unavailable";
    return commands.some((value) =>
      terms.some((term) => value.replace(/\s+/g, " ").includes(term)),
    )
      ? "failed"
      : "passed";
  } catch {
    return "unavailable";
  }
}
