import { expect, test } from "bun:test";
import { matchClaudeProjectInvocation } from "./claude-project-skills";
const input = {
  sessionId: "session-one",
  skill: "darrow-guide",
  skillDir: "/fixture/.claude/skills/darrow-guide",
  skillText:
    "---\nname: darrow-guide\ndescription: Explain Darrow\n---\n# Guide\nRead current sources.\n",
  prompt: "/darrow-guide What is Darrow?",
};
const command = {
  type: "user",
  sessionId: "session-one",
  message: {
    content:
      "<command-message>darrow-guide</command-message>\n<command-name>/darrow-guide</command-name>\n<command-args>What is Darrow?</command-args>",
  },
};
const body = {
  type: "user",
  isMeta: true,
  sessionId: "session-one",
  message: {
    content: [
      {
        type: "text",
        text: "Base directory for this skill: /fixture/.claude/skills/darrow-guide\n\n# Guide\nRead current sources.\n\nARGUMENTS: What is Darrow?",
      },
    ],
  },
};
const assistant = { type: "assistant", sessionId: "session-one" };
const transcript = (entries: unknown[]) =>
  entries.map((entry) => JSON.stringify(entry)).join("\n");
test("accepts one correlated complete project-command expansion without retaining contents", () => {
  const result = matchClaudeProjectInvocation({
    ...input,
    transcript: transcript([command, body, assistant]),
  });
  expect(result.accepted).toBe(true);
  expect(JSON.stringify(result)).not.toContain("Read current sources");
  expect(JSON.stringify(result)).not.toContain("What is Darrow");
});
test.each([
  [command, assistant],
  [body, command, assistant],
  [command, body, body, assistant],
  [command, command, body, assistant],
  [command, assistant, body],
  [{ ...command, sessionId: "stale-session" }, body, assistant],
  [command, { ...body, sessionId: "stale-session" }, assistant],
  [command, { ...body, isMeta: false }, assistant],
  [command, { ...body, isSidechain: true }, assistant],
  [
    command,
    {
      ...body,
      message: {
        content:
          "Base directory for this skill: /fixture/.claude/skills/darrow-guide\n\n# Guide",
      },
    },
    assistant,
  ],
  [
    {
      ...command,
      message: {
        content: command.message.content.replace(
          "What is Darrow?",
          "Invent another question",
        ),
      },
    },
    body,
    assistant,
  ],
])("rejects incomplete or mismatched invocation %j", (...entries) => {
  expect(
    matchClaudeProjectInvocation({ ...input, transcript: transcript(entries) })
      .accepted,
  ).toBe(false);
});
test("malformed or unfinished native evidence remains unknown", () => {
  expect(
    matchClaudeProjectInvocation({ ...input, transcript: "{bad" }).accepted,
  ).toBeNull();
  expect(
    matchClaudeProjectInvocation({
      ...input,
      transcript: transcript([command, body]),
    }).accepted,
  ).toBeNull();
});
