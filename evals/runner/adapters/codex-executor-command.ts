import ts from "typescript";

export interface LiteralExecutorCommand {
  command: string;
  cwd?: string;
  shell?: string;
}

function primitive(node: ts.Expression): string | number | boolean | undefined {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function literalOptions(
  node: ts.Expression,
): Map<string, string | number | boolean> | undefined {
  if (!ts.isObjectLiteralExpression(node)) return undefined;
  const values = new Map<string, string | number | boolean>();
  const allowed = new Set([
    "cmd",
    "workdir",
    "shell",
    "yield_time_ms",
    "max_output_tokens",
    "login",
    "tty",
  ]);
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) return undefined;
    const name = propertyName(property.name);
    const value = primitive(property.initializer);
    if (!name || !allowed.has(name) || values.has(name) || value === undefined)
      return undefined;
    values.set(name, value);
  }
  return values;
}

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name)
    ? name.text
    : undefined;
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function commandOptions(
  node: ts.Expression,
): LiteralExecutorCommand | undefined {
  const values = literalOptions(node);
  if (!values) return undefined;
  const command = values.get("cmd");
  const cwd = values.get("workdir");
  const shell = values.get("shell");
  if (
    typeof command !== "string" ||
    !command ||
    !optionalString(cwd) ||
    !optionalString(shell)
  )
    return undefined;
  return {
    command,
    ...(cwd === undefined ? {} : { cwd }),
    ...(shell === undefined ? {} : { shell }),
  };
}

function commandDeclaration(statement: ts.Statement):
  | {
      name: string;
      command: LiteralExecutorCommand;
    }
  | undefined {
  if (
    !ts.isVariableStatement(statement) ||
    !(statement.declarationList.flags & ts.NodeFlags.Const) ||
    statement.declarationList.declarations.length !== 1
  )
    return undefined;
  const declaration = statement.declarationList.declarations[0]!;
  if (
    !ts.isIdentifier(declaration.name) ||
    ["tools", "text", "store"].includes(declaration.name.text) ||
    !declaration.initializer
  )
    return undefined;
  const command = awaitedCommand(declaration.initializer);
  return command ? { name: declaration.name.text, command } : undefined;
}

function awaitedCommand(
  expression: ts.Expression,
): LiteralExecutorCommand | undefined {
  if (!ts.isAwaitExpression(expression)) return undefined;
  const call = expression.expression;
  if (
    !ts.isCallExpression(call) ||
    call.arguments.length !== 1 ||
    !ts.isPropertyAccessExpression(call.expression) ||
    !ts.isIdentifier(call.expression.expression) ||
    call.expression.expression.text !== "tools" ||
    call.expression.name.text !== "exec_command"
  )
    return undefined;
  return commandOptions(call.arguments[0]!);
}

function resultProperty(
  node: ts.Expression,
  name: string,
  field: string,
): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === name &&
    node.name.text === field
  );
}

function outputStatement(
  statement: ts.Statement,
  name: string,
): string | undefined {
  if (
    !ts.isExpressionStatement(statement) ||
    !ts.isCallExpression(statement.expression) ||
    !ts.isIdentifier(statement.expression.expression)
  )
    return undefined;
  return directOutput(statement.expression, name);
}

function directOutput(
  call: ts.CallExpression,
  name: string,
): string | undefined {
  const operation = (call.expression as ts.Identifier).text;
  if (
    operation === "text" &&
    call.arguments.length === 1 &&
    resultProperty(call.arguments[0]!, name, "output")
  )
    return "text";
  if (
    operation === "store" &&
    call.arguments.length === 2 &&
    ts.isStringLiteralLike(call.arguments[0]!) &&
    resultProperty(call.arguments[1]!, name, "session_id")
  )
    return "store";
  return undefined;
}

/** Recognize only one unconditional awaited command whose output is returned directly. */
export function literalExecutorCommand(
  code: unknown,
): LiteralExecutorCommand | undefined {
  if (typeof code !== "string") return undefined;
  const source = ts.createSourceFile(
    "native-exec.js",
    code,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS,
  );
  const diagnostics = (
    source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }
  ).parseDiagnostics;
  if (
    !diagnostics ||
    diagnostics.length ||
    source.statements.length < 2 ||
    source.statements.length > 3
  )
    return undefined;
  const declaration = commandDeclaration(source.statements[0]!);
  if (!declaration) return undefined;
  const outputs = source.statements
    .slice(1)
    .map((statement) => outputStatement(statement, declaration.name));
  if (
    outputs.some((output) => output === undefined) ||
    outputs.filter((output) => output === "text").length !== 1 ||
    outputs.filter((output) => output === "store").length > 1
  )
    return undefined;
  return declaration.command;
}
