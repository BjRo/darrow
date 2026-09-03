import { pathToFileURL } from "node:url";

export interface Presentation {
  color: boolean;
  emoji: boolean;
  progress: boolean;
  hyperlinks: boolean;
}

export interface PresentationRequest {
  isTTY: boolean;
  env: Record<string, string | undefined>;
  noColor?: boolean;
  noEmoji?: boolean;
  noProgress?: boolean;
}

export interface ProgressState {
  completed: number;
  total: number;
  caseId: string;
  trial: number;
  trials: number;
  elapsedMs: number;
  spinnerIndex: number;
}

export interface ActivationLine {
  passed: boolean | null;
  className: string;
  targetSkill: string;
  primarySkill: string | null;
  source: string | null;
}

export interface TrialLine {
  passed: boolean;
  caseId: string;
  trial: number;
  trials: number;
  completed: number;
  total: number;
  durationMs: number;
  tokens: number | null;
  failedChecks: Array<{ name: string; detail: string }>;
  activation?: ActivationLine;
  judge?: string;
  semanticOutput?: string;
  dry?: boolean;
}

export interface CaseSummary {
  caseId: string;
  invariant: string;
  passed: boolean;
  taskPassed: boolean;
  passRate: number;
  activationPassRate?: number | null;
  activationPassed?: boolean | null;
  trials: number;
  meanDurationMs: number;
  meanTokens: number | null;
  dry?: boolean;
}

export interface RunHeading {
  harness: string;
  model: string;
  effort: string;
  harnessVersion?: string;
  cases: number;
  trials: number;
  jobs: number;
  threshold: number;
  condition?: string;
  dry: boolean;
}

interface WritableTerminal {
  write(chunk: string): unknown;
  columns?: number;
}

const ANSI = {
  bold: "1",
  dim: "2",
  red: "31",
  green: "32",
  yellow: "33",
  cyan: "36",
} as const;
const SPINNERS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function paint(
  text: string,
  code: (typeof ANSI)[keyof typeof ANSI],
  presentation: Presentation,
): string {
  return presentation.color ? `\u001B[${code}m${text}\u001B[0m` : text;
}

function stripAnsi(text: string): string {
  // ANSI escape is intentionally matched so terminal styling does not affect width.
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001B\[[0-9;]*m/g, "");
}

function truncate(text: string, width: number): string {
  if (width < 2) return text.slice(0, Math.max(0, width));
  return text.length <= width ? text : `${text.slice(0, width - 1)}…`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  return `${minutes}m ${Math.round((durationMs % 60_000) / 1000)}s`;
}

function formatTokens(tokens: number | null): string {
  if (tokens === null) return "tokens unknown";
  if (tokens < 1_000) return `${tokens} tokens`;
  return `${(tokens / 1_000).toFixed(1)}k tokens`;
}

function statusLabel(passed: boolean, presentation: Presentation): string {
  const text = presentation.emoji
    ? passed
      ? "✓"
      : "✕"
    : passed
      ? "PASS"
      : "FAIL";
  return paint(text, passed ? ANSI.green : ANSI.red, presentation);
}

function neutralLabel(presentation: Presentation): string {
  return paint(presentation.emoji ? "◌" : "DRY", ANSI.yellow, presentation);
}

export function resolvePresentation(
  request: PresentationRequest,
): Presentation {
  const capable = request.isTTY && request.env.TERM !== "dumb";
  return {
    color: capable && !request.noColor && request.env.NO_COLOR === undefined,
    emoji: capable && !request.noEmoji,
    progress: capable && !request.noProgress,
    hyperlinks: capable,
  };
}

export function progressFrame(
  state: ProgressState,
  width: number,
  presentation: Presentation,
): string {
  const ratio = state.total ? state.completed / state.total : 0;
  const percent = Math.round(ratio * 100);
  const barWidth = Math.max(10, Math.min(24, Math.floor(width / 5)));
  const filled = Math.round(barWidth * ratio);
  const completeBar = "█".repeat(filled);
  const remainingBar = "░".repeat(barWidth - filled);
  const bar = `${completeBar}${remainingBar}`;
  const spinner = presentation.emoji
    ? SPINNERS[state.spinnerIndex % SPINNERS.length]
    : "RUN";
  const fixed = `${spinner} Evaluating  [${bar}] ${state.completed}/${state.total} ${percent}%`;
  const suffix = `${state.caseId} · trial ${state.trial}/${state.trials} · ${formatDuration(state.elapsedMs)}`;
  const available = Math.max(1, width - stripAnsi(fixed).length - 2);
  const styled = `${paint(`${spinner} Evaluating`, ANSI.cyan, presentation)}  [${paint(completeBar, ANSI.cyan, presentation)}${paint(remainingBar, ANSI.dim, presentation)}] ${state.completed}/${state.total} ${percent}%`;
  return `${styled}  ${truncate(suffix, available)}`;
}

function outcomesLine(
  taskPassed: boolean,
  activation: ActivationLine,
  presentation: Presentation,
): string {
  const known = activation.passed !== null;
  const state = !known ? "unknown" : activation.passed ? "passed" : "failed";
  const color = !known
    ? ANSI.yellow
    : activation.passed
      ? ANSI.green
      : ANSI.red;
  const taskColor = taskPassed ? ANSI.green : ANSI.red;
  const task = paint(
    `Task ${taskPassed ? "passed" : "failed"}`,
    taskColor,
    presentation,
  );
  const activationState = paint(`Activation ${state}`, color, presentation);
  const route = !known
    ? `· ${activation.className} · source unavailable`
    : activation.passed
      ? `· ${activation.targetSkill} selected`
      : `· expected ${activation.targetSkill}, got ${activation.primarySkill ?? "none"}`;
  return `   ${task}  ·  ${activationState} ${paint(route, ANSI.dim, presentation)}`;
}

function trialOutcome(trial: TrialLine, presentation: Presentation) {
  const passed = trial.passed && trial.activation?.passed !== false;
  if (trial.dry) {
    return {
      label: neutralLabel(presentation),
      state: paint("Prepared", ANSI.yellow, presentation),
    };
  }
  return {
    label: statusLabel(passed, presentation),
    state: "",
  };
}

function failedCheckLine(
  check: { name: string; detail: string },
  presentation: Presentation,
): string {
  const arrow = paint(presentation.emoji ? "↳" : "-", ANSI.red, presentation);
  return `   ${arrow} ${paint(check.name, ANSI.red, presentation)} ${paint(`· ${check.detail}`, ANSI.dim, presentation)}`;
}

export function trialLines(
  trial: TrialLine,
  presentation: Presentation,
): string[] {
  const outcome = trialOutcome(trial, presentation);
  const metrics = `${formatDuration(trial.durationMs)} · ${formatTokens(trial.tokens)}`;
  const lines = [
    `${outcome.label}${outcome.state ? ` ${outcome.state}` : ""} ${paint(`${trial.completed}/${trial.total}`, ANSI.dim, presentation)}  ${trial.caseId} ${paint(`· trial ${trial.trial}/${trial.trials} · ${metrics}`, ANSI.dim, presentation)}`,
  ];
  if (trial.activation) {
    lines.push(outcomesLine(trial.passed, trial.activation, presentation));
  }
  lines.push(
    ...trial.failedChecks.map((check) => failedCheckLine(check, presentation)),
  );
  if (trial.judge && !trial.judge.startsWith("pass"))
    lines.push(`   ${paint("Judge", ANSI.dim, presentation)} · ${trial.judge}`);
  if (trial.semanticOutput && !trial.semanticOutput.startsWith("graded"))
    lines.push(
      `   ${paint("Semantic output", ANSI.dim, presentation)} · ${trial.semanticOutput}`,
    );
  return lines;
}

function summaryStatus(item: CaseSummary, presentation: Presentation): string {
  return item.dry
    ? neutralLabel(presentation)
    : statusLabel(item.passed, presentation);
}

function summaryRow(
  item: CaseSummary,
  caseWidth: number,
  presentation: Presentation,
): string {
  const taskText = (
    item.dry ? "—" : `${Math.round(item.passRate * 100)}%`
  ).padStart(4);
  const task = item.dry
    ? taskText
    : paint(taskText, item.taskPassed ? ANSI.green : ANSI.red, presentation);
  const activationText = activationSummaryText(item).padStart(4);
  const activation = activationSummaryColor(item, activationText, presentation);
  const mean = formatDuration(item.meanDurationMs).padStart(7);
  const tokens = formatTokens(item.meanTokens)
    .replace(" tokens", "")
    .padStart(8);
  return `${summaryStatus(item, presentation)}${presentation.emoji ? "  " : " "}${truncate(item.caseId, caseWidth).padEnd(caseWidth)}  ${task}  ${activation}  ${mean}  ${tokens}`;
}

function activationSummaryText(item: CaseSummary): string {
  if (item.dry || item.activationPassRate === undefined) return "—";
  if (item.activationPassRate === null) return "?";
  return `${Math.round(item.activationPassRate * 100)}%`;
}

function activationSummaryColor(
  item: CaseSummary,
  text: string,
  presentation: Presentation,
): string {
  if (item.activationPassed === undefined || item.dry) return text;
  if (item.activationPassed === null)
    return paint(text, ANSI.yellow, presentation);
  return paint(
    text,
    item.activationPassed ? ANSI.green : ANSI.red,
    presentation,
  );
}

function summaryCounts(
  passed: number,
  failed: number,
  presentation: Presentation,
): string {
  const passCount = passed
    ? `${statusLabel(true, presentation)} ${paint(`${passed} passed`, ANSI.green, presentation)}`
    : paint("0 passed", ANSI.dim, presentation);
  const failCount = failed
    ? `${statusLabel(false, presentation)} ${paint(`${failed} failed`, ANSI.red, presentation)}`
    : paint("0 failed", ANSI.dim, presentation);
  return `${passCount} · ${failCount}`;
}

export function summaryLines(
  cases: CaseSummary[],
  presentation: Presentation,
  elapsedMs?: number,
): string[] {
  const passed = cases.filter((item) => item.passed).length;
  const failed = cases.length - passed;
  const trials = cases.reduce((total, item) => total + item.trials, 0);
  const dry = cases.length > 0 && cases.every((item) => item.dry);
  const caseWidth = Math.max(
    12,
    Math.min(44, ...cases.map((item) => item.caseId.length)),
  );
  const counts = dry
    ? `${paint(`${cases.length} prepared`, ANSI.yellow, presentation)} · dry run`
    : summaryCounts(passed, failed, presentation);
  const elapsed =
    elapsedMs === undefined ? "" : ` · ${formatDuration(elapsedMs)}`;
  return [
    "",
    paint(
      presentation.emoji ? "✨ Results" : "Results",
      ANSI.bold,
      presentation,
    ),
    `${counts} · ${cases.length} cases · ${trials} trials${elapsed}`,
    "",
    paint("─".repeat(Math.min(78, caseWidth + 36)), ANSI.dim, presentation),
    `${"".padEnd(presentation.emoji ? 3 : 5)} ${"CASE".padEnd(caseWidth)}  TASK   ACT     MEAN    TOKENS`,
    ...cases.map((item) => summaryRow(item, caseWidth, presentation)),
    paint("─".repeat(Math.min(78, caseWidth + 36)), ANSI.dim, presentation),
  ];
}

export function artifactLine(
  resultPath: string,
  presentation: Presentation,
): string {
  const visible = paint(resultPath, ANSI.cyan, presentation);
  const linked = presentation.hyperlinks
    ? `\u001B]8;;${pathToFileURL(resultPath).href}\u0007${visible}\u001B]8;;\u0007`
    : visible;
  return `${presentation.emoji ? "📄 " : ""}Results: ${linked}`;
}

export function headingLines(
  heading: RunHeading,
  presentation: Presentation,
): string[] {
  const target = `${heading.harness} / ${heading.model} / ${heading.effort}`;
  const context = [heading.harnessVersion, heading.condition]
    .filter(Boolean)
    .join(" · ");
  return [
    paint(
      presentation.emoji ? "🧪  Darrow Eval" : "Darrow Eval",
      ANSI.bold,
      presentation,
    ),
    paint("─".repeat(72), ANSI.dim, presentation),
    `${paint("Target", ANSI.dim, presentation)}   ${target}`,
    `${paint("Run", ANSI.dim, presentation)}      ${heading.cases} cases × ${heading.trials} trials · ${heading.cases * heading.trials} total · jobs ${heading.jobs} · threshold ${(heading.threshold * 100).toFixed(0)}%`,
    ...(context
      ? [`${paint("Context", ANSI.dim, presentation)}  ${context}`]
      : []),
    ...(heading.dry
      ? [paint("Dry run · no harness calls", ANSI.yellow, presentation)]
      : []),
    "",
  ];
}

export class EvalCliUi {
  private completed = 0;
  private started = 0;
  private readonly startedAt = Date.now();
  private currentCaseId?: string;
  private active?: {
    state: Omit<ProgressState, "elapsedMs" | "spinnerIndex">;
    startedAt: number;
  };
  private timer?: ReturnType<typeof setInterval>;
  private spinnerIndex = 0;

  constructor(
    readonly presentation: Presentation,
    private readonly total: number,
    private readonly stream: WritableTerminal = process.stdout,
  ) {}

  heading(heading: RunHeading): void {
    this.writeLines(headingLines(heading, this.presentation));
  }

  startTrial(caseId: string, trial: number, trials: number): void {
    if (this.currentCaseId && this.currentCaseId !== caseId)
      this.stream.write("\n");
    this.currentCaseId = caseId;
    this.started++;
    this.active = {
      state: {
        completed: this.completed,
        total: this.total,
        caseId,
        trial,
        trials,
      },
      startedAt: Date.now(),
    };
    if (!this.presentation.progress) {
      this.stream.write(
        `RUN ${this.started}/${this.total}  ${caseId} · trial ${trial}/${trials}\n`,
      );
      return;
    }
    this.renderProgress();
    this.timer = setInterval(() => this.renderProgress(), 80);
    this.timer.unref();
  }

  finishTrial(trial: Omit<TrialLine, "completed" | "total">): void {
    this.stopProgress();
    this.completed++;
    this.writeLines(
      trialLines(
        { ...trial, completed: this.completed, total: this.total },
        this.presentation,
      ),
    );
    this.active = undefined;
  }

  finish(cases: CaseSummary[], resultPath: string): void {
    this.stopProgress();
    this.writeLines(
      summaryLines(cases, this.presentation, Date.now() - this.startedAt),
    );
    this.stream.write(`\n${artifactLine(resultPath, this.presentation)}\n`);
  }

  stop(): void {
    this.stopProgress();
  }

  private writeLines(lines: string[]): void {
    this.stream.write(`${lines.join("\n")}\n`);
  }

  private renderProgress(): void {
    if (!this.active) return;
    const width =
      this.stream.columns && this.stream.columns >= 40
        ? this.stream.columns
        : 100;
    const frame = progressFrame(
      {
        ...this.active.state,
        elapsedMs: Date.now() - this.active.startedAt,
        spinnerIndex: this.spinnerIndex++,
      },
      width,
      this.presentation,
    );
    this.stream.write(`\r\u001B[2K${frame}`);
  }

  private stopProgress(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (this.active && this.presentation.progress)
      this.stream.write("\r\u001B[2K");
  }
}
