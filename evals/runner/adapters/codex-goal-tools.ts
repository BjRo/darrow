import ts from "typescript";

const GOAL_CONTROLS = new Set(["create_goal", "get_goal", "update_goal"]);

interface NativeEntry {
  ordinal: number;
  payload: Record<string, unknown>;
}

/** Syntax observations only: do not evaluate code or infer control flow. */
function goalControlReferences(code: string): string[] {
  const source = ts.createSourceFile(
    "native-exec.js",
    code,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS,
  );
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const target = node.expression;
      if (
        (ts.isPropertyAccessExpression(target) ||
          ts.isElementAccessExpression(target)) &&
        ts.isIdentifier(target.expression) &&
        target.expression.text === "tools"
      ) {
        const name = ts.isPropertyAccessExpression(target)
          ? target.name.text
          : ts.isStringLiteral(target.argumentExpression)
            ? target.argumentExpression.text
            : undefined;
        if (name && GOAL_CONTROLS.has(name)) found.add(name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...found];
}

/** Preserve only allowlisted names; arguments and results never leave here. */
export function retainedCodexGoalControls(entries: NativeEntry[]): object[] {
  return entries.flatMap(({ ordinal, payload }) => {
    if (payload.namespace !== undefined && payload.namespace !== "functions")
      return [];
    if (
      payload.type === "function_call" &&
      typeof payload.name === "string" &&
      GOAL_CONTROLS.has(payload.name)
    )
      return [
        {
          type: "darrow.codex_native_goal_control",
          ordinal,
          tool: payload.name,
          source: "native_function_call",
          evidence: "invocation_attempt",
          outcome: "unverified",
        },
      ];
    if (
      payload.type !== "custom_tool_call" ||
      payload.name !== "exec" ||
      typeof payload.input !== "string"
    )
      return [];
    return goalControlReferences(payload.input).map((tool) => ({
      type: "darrow.codex_native_goal_control",
      ordinal,
      tool,
      source: "submitted_exec_code",
      evidence: "call_expression_reference",
      outcome: "unverified",
    }));
  });
}
