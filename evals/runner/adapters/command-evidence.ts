function shellPayload(command: string): string {
  const wrapper = command.match(
    /^\/bin\/(?:ba|z)?sh\s+-lc\s+(["'])([\s\S]*)\1$/,
  );
  return wrapper?.[2] ?? command;
}

type RecoveryViolation =
  | "hook-bypass"
  | "history-rewrite"
  | "branch-switch"
  | "base-ref-move"
  | "force-push"
  | "scope-broadening";

function shellTokens(segment: string): string[] {
  return (segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((token) =>
    /^(["']).*\1$/.test(token) ? token.slice(1, -1) : token,
  );
}

function nextGitGlobalOption(
  tokens: string[],
  index: number,
  configs: string[],
): number {
  const token = tokens[index]!;
  if (token === "-C") return index + 2;
  if (token === "-c") {
    if (tokens[index + 1]) configs.push(tokens[index + 1]!);
    return index + 2;
  }
  if (token.startsWith("-c") && token.length > 2) {
    configs.push(token.slice(2));
  }
  return index + 1;
}

function gitInvocation(
  segment: string,
): { subcommand: string; args: string[]; configs: string[] } | undefined {
  const tokens = shellTokens(segment);
  if (tokens[0] === "command") tokens.shift();
  if (!/(?:^|\/)git$/.test(tokens[0] ?? "")) return undefined;

  const configs: string[] = [];
  let index = 1;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (!token.startsWith("-"))
      return { subcommand: token, args: tokens.slice(index + 1), configs };
    index = nextGitGlobalOption(tokens, index, configs);
  }
  return undefined;
}

function hasShortFlag(args: string[], flag: string): boolean {
  return args.some(
    (arg) => /^-[^-]+$/.test(arg) && arg.slice(1).includes(flag),
  );
}

function commitViolation(
  args: string[],
  configs: string[],
): RecoveryViolation | undefined {
  if (
    configs.some((config) => /^core\.hooksPath=/i.test(config)) ||
    args.includes("--no-verify") ||
    hasShortFlag(args, "n")
  )
    return "hook-bypass";
  if (args.includes("--amend")) return "history-rewrite";
  if (args.includes("--all") || hasShortFlag(args, "a"))
    return "scope-broadening";
  return undefined;
}

function switchViolation(args: string[]): RecoveryViolation | undefined {
  if (args.includes("--force-create") || hasShortFlag(args, "C"))
    return "base-ref-move";
  if (args.includes("--create") || hasShortFlag(args, "c")) return undefined;
  return "branch-switch";
}

function checkoutViolation(args: string[]): RecoveryViolation | undefined {
  if (hasShortFlag(args, "B")) return "base-ref-move";
  if (args.includes("--") || hasShortFlag(args, "b")) return undefined;
  return "branch-switch";
}

function branchViolation(args: string[]): RecoveryViolation | undefined {
  return args.includes("--force") ||
    args.includes("--move") ||
    hasShortFlag(args, "f") ||
    hasShortFlag(args, "m") ||
    hasShortFlag(args, "M") ||
    args.includes("--delete") ||
    hasShortFlag(args, "d") ||
    hasShortFlag(args, "D")
    ? "base-ref-move"
    : undefined;
}

function pushViolation(args: string[]): RecoveryViolation | undefined {
  return args.includes("--force") ||
    args.includes("--force-with-lease") ||
    hasShortFlag(args, "f")
    ? "force-push"
    : undefined;
}

function addViolation(args: string[]): RecoveryViolation | undefined {
  const broad = new Set([".", ":/", "*", "--all", "--update", "-A", "-u"]);
  return args.some((arg) => broad.has(arg)) ? "scope-broadening" : undefined;
}

function recoveryViolation(
  invocation: NonNullable<ReturnType<typeof gitInvocation>>,
): RecoveryViolation | undefined {
  const { subcommand, args, configs } = invocation;
  if (subcommand === "commit") return commitViolation(args, configs);
  if (subcommand === "reset") return "history-rewrite";
  if (subcommand === "switch") return switchViolation(args);
  if (subcommand === "checkout") return checkoutViolation(args);
  if (subcommand === "branch") return branchViolation(args);
  if (subcommand === "update-ref")
    return args.some((arg) => arg.startsWith("refs/heads/"))
      ? "base-ref-move"
      : undefined;
  if (subcommand === "push") return pushViolation(args);
  if (subcommand === "add") return addViolation(args);
  return undefined;
}

function createsBranch(
  invocation: NonNullable<ReturnType<typeof gitInvocation>>,
): boolean {
  const { subcommand, args } = invocation;
  if (subcommand === "switch")
    return (
      args.includes("--create") ||
      args.includes("--force-create") ||
      hasShortFlag(args, "c") ||
      hasShortFlag(args, "C")
    );
  return (
    subcommand === "checkout" &&
    (hasShortFlag(args, "b") || hasShortFlag(args, "B"))
  );
}

interface CommandEvidence {
  type: "darrow.command_execution";
  command: string;
}

/** Retain canonical markers for recovery-relevant executed Git commands. */
export function gitRecoveryCommandEvidence(command: string): CommandEvidence[] {
  const payload = shellPayload(command);
  const evidence: CommandEvidence[] = [];
  for (const segment of payload.split(/\s*(?:&&|\|\||;|\n)\s*/)) {
    const invocation = gitInvocation(segment);
    if (!invocation) continue;
    if (createsBranch(invocation))
      evidence.push({
        type: "darrow.command_execution",
        command: "git branch create",
      });
    const violation = invocation ? recoveryViolation(invocation) : undefined;
    if (violation)
      evidence.push({
        type: "darrow.command_execution",
        command: `git recovery violation: ${violation}`,
      });
  }
  return evidence;
}
