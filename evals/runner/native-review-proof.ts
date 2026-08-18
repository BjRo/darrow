import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

type JsonObject = Record<string, unknown>;
type SessionEntry = { ordinal: number; timestamp: string; value: JsonObject };

export type NativeReviewProofOptions = {
  session: string;
  scope: string;
  routeRecord: string;
  standardsRecord: string;
  standardsCall: string;
  specRecord: string;
  specCall: string;
  output?: string;
};

type Route = {
  host: string;
  provider: string;
  model: string;
  effort: string;
  source: string;
};

type LaunchProof = {
  axis: string;
  callId: string;
  taskName: string;
  childId: string;
  threadId: string;
  model: string;
  effort: string;
  forkTurns: string;
  requestedAt: string;
  requestedOrdinal: number;
  startedAt: string;
  startedOrdinal: number;
  acceptedAt: string;
  acceptedOrdinal: number;
};

type LaunchInput = {
  entries: SessionEntry[];
  callId: string;
  axis: string;
  agentId: string;
  route: Route;
};

type ReviewInputs = {
  session: string;
  scopeText: string;
  routeText: string;
  standardsText: string;
  specText: string;
};

type NativeReviewProof = {
  format: "darrow-code-review-native-live-v1";
  outcome: "pass";
  source: {
    session: string;
    sessionPrefixCanonicalSha256: string;
    sessionPrefixThroughOrdinal: number;
    scopeManifest: string;
    scopeTarget: string;
    scopeChecksum: string;
    routeRecord: string;
  };
  selectedRoute: Route;
  launches: LaunchProof[];
  firstWait: { callId: string; timestamp: string; ordinal: number };
  checks: {
    distinctChildren: true;
    axisMarkedTaskNames: true;
    bothNativeStartsObserved: true;
    bothAcceptedBeforeFirstWait: true;
    exactRetainedLaunchBatch: true;
    applicationRecordsBound: true;
  };
  limitations: string[];
};

const object = (value: unknown, label: string): JsonObject => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as JsonObject;
};

const string = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${label} must be a non-empty string`);
  return value;
};

function parseSession(content: string): SessionEntry[] {
  return content
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const value = object(JSON.parse(line), `session line ${index + 1}`);
      const ordinal = value.ordinal;
      if (!Number.isInteger(ordinal))
        throw new Error(`session line ${index + 1} has no integer ordinal`);
      return {
        ordinal: ordinal as number,
        timestamp: string(
          value.timestamp,
          `session line ${index + 1} timestamp`,
        ),
        value,
      };
    });
}

function parseTsv(content: string): Map<string, string[][]> {
  const rows = new Map<string, string[][]>();
  for (const line of content.trimEnd().split("\n")) {
    const [key, ...values] = line.split("\t");
    if (!key) throw new Error("record contains an empty key");
    rows.set(key, [...(rows.get(key) ?? []), values]);
  }
  return rows;
}

function oneRow(rows: Map<string, string[][]>, key: string): string[] {
  const found = rows.get(key) ?? [];
  if (found.length !== 1) throw new Error(`record must contain one ${key} row`);
  return found[0] ?? [];
}

function oneValue(rows: Map<string, string[][]>, key: string): string {
  const values = oneRow(rows, key);
  if (values.length !== 1 || !values[0])
    throw new Error(`${key} must contain one non-empty value`);
  return values[0];
}

function routeFrom(rows: Map<string, string[][]>): Route {
  const selected = oneRow(rows, "selected_route");
  if (selected.length !== 4 || selected.some((value) => !value))
    throw new Error(
      "selected_route must contain host, provider, model, effort",
    );
  const [host, provider, model, effort] = selected as [
    string,
    string,
    string,
    string,
  ];
  if (host !== "codex")
    throw new Error("native Codex proof requires a codex route");
  if (provider !== "openai")
    throw new Error("native Codex proof requires the OpenAI provider");
  return {
    host,
    provider,
    model,
    effort,
    source: oneValue(rows, "route_source"),
  };
}

function payload(entry: SessionEntry): JsonObject {
  return object(
    entry.value.payload,
    `session ordinal ${entry.ordinal} payload`,
  );
}

function matchingEntry(
  entries: SessionEntry[],
  predicate: (entryPayload: JsonObject) => boolean,
  label: string,
): SessionEntry {
  const matches = entries.filter((entry) => predicate(payload(entry)));
  if (matches.length !== 1)
    throw new Error(`expected one ${label}, found ${matches.length}`);
  return matches[0] as SessionEntry;
}

function verifyApplicationRecord(
  content: string,
  route: Route,
  axis: string,
): string {
  const rows = parseTsv(content);
  const expected = [route.host, route.provider, route.model, route.effort];
  for (const key of ["selected_route", "requested_route"])
    if (oneRow(rows, key).join("\t") !== expected.join("\t"))
      throw new Error(`${axis} ${key} does not match the selected route`);
  if (oneValue(rows, "route_bound") !== "true")
    throw new Error(`${axis} application record is not route_bound`);
  if (oneValue(rows, "route_applied_by") !== "native-subagent")
    throw new Error(
      `${axis} application record is not native-subagent evidence`,
    );
  if (oneValue(rows, "axis") !== axis)
    throw new Error(`${axis} application record has the wrong axis`);
  return oneValue(rows, "agent_id");
}

function spawnRequest(input: LaunchInput) {
  const { entries, callId, axis, agentId, route } = input;
  const request = matchingEntry(
    entries,
    (item) =>
      item.type === "function_call" &&
      item.name === "spawn_agent" &&
      item.namespace === "collaboration" &&
      item.call_id === callId,
    `${axis} spawn request`,
  );
  const args = object(
    JSON.parse(string(payload(request).arguments, `${axis} spawn arguments`)),
    `${axis} spawn arguments`,
  );
  const expectedTask = agentId.replace(/^\/root\//, "");
  const axisMarker = new RegExp(`(^|[-_])${axis}($|[-_])`);
  const oppositeAxis = axis === "standards" ? "spec" : "standards";
  const oppositeMarker = new RegExp(`(^|[-_])${oppositeAxis}($|[-_])`);
  if (
    args.task_name !== expectedTask ||
    !axisMarker.test(expectedTask) ||
    oppositeMarker.test(expectedTask) ||
    args.model !== route.model ||
    args.reasoning_effort !== route.effort ||
    args.fork_turns !== "none"
  )
    throw new Error(`${axis} spawn request does not match its bound route`);
  return { request, expectedTask };
}

function nativeStart(input: LaunchInput) {
  const { entries, callId, axis, agentId } = input;
  const started = matchingEntry(
    entries,
    (item) => {
      if (item.type !== "item_completed") return false;
      const activity = object(item.item, `${axis} activity`);
      return (
        activity.type === "SubAgentActivity" &&
        activity.id === callId &&
        activity.kind === "started" &&
        activity.agent_path === agentId
      );
    },
    `${axis} native start`,
  );
  const activity = object(payload(started).item, `${axis} activity`);
  return { started, activity };
}

function spawnAcceptance(input: LaunchInput) {
  const { entries, callId, axis, agentId } = input;
  const accepted = matchingEntry(
    entries,
    (item) => item.type === "function_call_output" && item.call_id === callId,
    `${axis} spawn acceptance`,
  );
  const acceptedOutput = object(
    JSON.parse(string(payload(accepted).output, `${axis} spawn output`)),
    `${axis} spawn output`,
  );
  if (acceptedOutput.task_name !== agentId)
    throw new Error(`${axis} spawn output does not identify the bound child`);
  return accepted;
}

function launchFrom(input: LaunchInput): LaunchProof {
  const { axis, callId, agentId, route } = input;
  const { request, expectedTask } = spawnRequest(input);
  const { started, activity } = nativeStart(input);
  const accepted = spawnAcceptance(input);
  if (!(
    request.ordinal < started.ordinal && started.ordinal < accepted.ordinal
  ))
    throw new Error(`${axis} native launch events are out of order`);
  return {
    axis,
    callId,
    taskName: expectedTask,
    childId: agentId,
    threadId: string(activity.agent_thread_id, `${axis} native thread id`),
    model: route.model,
    effort: route.effort,
    forkTurns: "none",
    requestedAt: request.timestamp,
    requestedOrdinal: request.ordinal,
    startedAt: started.timestamp,
    startedOrdinal: started.ordinal,
    acceptedAt: accepted.timestamp,
    acceptedOrdinal: accepted.ordinal,
  };
}

function waitEntry(entries: SessionEntry[], firstRequest: number) {
  const waits = entries.filter((entry) => {
    const item = payload(entry);
    return (
      entry.ordinal > firstRequest &&
      item.type === "function_call" &&
      item.name === "wait_agent" &&
      item.namespace === "collaboration"
    );
  });
  if (!waits.length)
    throw new Error("no wait_agent call follows the reviewer launches");
  return waits.sort(
    (left, right) => left.ordinal - right.ordinal,
  )[0] as SessionEntry;
}

function previousWaitOrdinal(entries: SessionEntry[], firstRequest: number) {
  return entries
    .filter((entry) => {
      const item = payload(entry);
      return (
        entry.ordinal < firstRequest &&
        item.type === "function_call" &&
        item.name === "wait_agent" &&
        item.namespace === "collaboration"
      );
    })
    .reduce((latest, entry) => Math.max(latest, entry.ordinal), 0);
}

function verifyRetainedSpawnBatch(
  entries: SessionEntry[],
  launches: LaunchProof[],
  firstRequest: number,
  wait: SessionEntry,
) {
  const priorWaitOrdinal = previousWaitOrdinal(entries, firstRequest);
  const expectedCalls = new Set(launches.map((launch) => launch.callId));
  const retainedBatch = entries.filter((entry) => {
    const item = payload(entry);
    return (
      entry.ordinal > priorWaitOrdinal &&
      entry.ordinal < wait.ordinal &&
      item.type === "function_call" &&
      item.name === "spawn_agent" &&
      item.namespace === "collaboration"
    );
  });
  if (
    retainedBatch.length !== launches.length ||
    retainedBatch.some(
      (entry) =>
        typeof payload(entry).call_id !== "string" ||
        !expectedCalls.has(payload(entry).call_id as string),
    )
  )
    throw new Error(
      `native launch batch contains ${retainedBatch.length} spawn requests; expected exactly two bound readers`,
    );
}

function firstWait(entries: SessionEntry[], launches: LaunchProof[]) {
  const firstRequest = Math.min(
    ...launches.map((launch) => launch.requestedOrdinal),
  );
  const wait = waitEntry(entries, firstRequest);
  if (launches.some((launch) => launch.acceptedOrdinal >= wait.ordinal))
    throw new Error(
      "both reviewer launches were not accepted before the first wait",
    );
  verifyRetainedSpawnBatch(entries, launches, firstRequest, wait);
  return {
    callId: string(payload(wait).call_id, "first wait call id"),
    timestamp: wait.timestamp,
    ordinal: wait.ordinal,
  };
}

function sessionPrefixHash(entries: SessionEntry[], throughOrdinal: number) {
  const prefix = entries
    .filter((entry) => entry.ordinal <= throughOrdinal)
    .map((entry) => JSON.stringify(entry.value))
    .join("\n");
  return createHash("sha256").update(`${prefix}\n`).digest("hex");
}

function validatePaths(options: NativeReviewProofOptions) {
  for (const name of [
    "session",
    "scope",
    "routeRecord",
    "standardsRecord",
    "specRecord",
  ] as const)
    if (!isAbsolute(options[name]))
      throw new Error(`${name} must be an absolute path`);
}

async function readInputs(
  options: NativeReviewProofOptions,
): Promise<ReviewInputs> {
  const [session, scopeText, routeText, standardsText, specText] =
    await Promise.all([
      readFile(options.session, "utf8"),
      readFile(options.scope, "utf8"),
      readFile(options.routeRecord, "utf8"),
      readFile(options.standardsRecord, "utf8"),
      readFile(options.specRecord, "utf8"),
    ]);
  return { session, scopeText, routeText, standardsText, specText };
}

function reviewLaunches(
  entries: SessionEntry[],
  route: Route,
  options: NativeReviewProofOptions,
  records: { standards: string; spec: string },
): LaunchProof[] {
  const standardsId = verifyApplicationRecord(
    records.standards,
    route,
    "standards",
  );
  const specId = verifyApplicationRecord(records.spec, route, "spec");
  const launches = [
    launchFrom({
      entries,
      callId: options.standardsCall,
      axis: "standards",
      agentId: standardsId,
      route,
    }),
    launchFrom({
      entries,
      callId: options.specCall,
      axis: "spec",
      agentId: specId,
      route,
    }),
  ];
  if (standardsId === specId || launches[0]?.threadId === launches[1]?.threadId)
    throw new Error("standards and spec must use distinct native children");
  return launches;
}

export async function buildNativeReviewProof(
  options: NativeReviewProofOptions,
): Promise<NativeReviewProof> {
  validatePaths(options);
  const { session, scopeText, routeText, standardsText, specText } =
    await readInputs(options);
  const entries = parseSession(session);
  const scope = parseTsv(scopeText);
  const route = routeFrom(parseTsv(routeText));
  const launches = reviewLaunches(entries, route, options, {
    standards: standardsText,
    spec: specText,
  });
  const wait = firstWait(entries, launches);
  return {
    format: "darrow-code-review-native-live-v1",
    outcome: "pass",
    source: {
      session: options.session,
      sessionPrefixCanonicalSha256: sessionPrefixHash(entries, wait.ordinal),
      sessionPrefixThroughOrdinal: wait.ordinal,
      scopeManifest: options.scope,
      scopeTarget: oneValue(scope, "target"),
      scopeChecksum: oneValue(scope, "scope_checksum"),
      routeRecord: options.routeRecord,
    },
    selectedRoute: route,
    launches,
    firstWait: wait,
    checks: {
      distinctChildren: true,
      axisMarkedTaskNames: true,
      bothNativeStartsObserved: true,
      bothAcceptedBeforeFirstWait: true,
      exactRetainedLaunchBatch: true,
      applicationRecordsBound: true,
    },
    limitations: [
      "N=1 and Codex-only; this artifact does not establish cross-run variance.",
      "The persisted spawn prompt is encrypted; axis binding uses the host-visible axis-marked task name, child path, and application record.",
      "This artifact does not prove a live Claude launch.",
    ],
  };
}

function cliOptions(args: string[]): NativeReviewProofOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || !value)
      throw new Error("arguments must be --name value pairs");
    values.set(flag.slice(2), value);
  }
  const required = [
    "session",
    "scope",
    "route-record",
    "standards-record",
    "standards-call",
    "spec-record",
    "spec-call",
    "output",
  ];
  for (const key of required)
    if (!values.get(key)) throw new Error(`missing --${key}`);
  return {
    session: values.get("session") as string,
    scope: values.get("scope") as string,
    routeRecord: values.get("route-record") as string,
    standardsRecord: values.get("standards-record") as string,
    standardsCall: values.get("standards-call") as string,
    specRecord: values.get("spec-record") as string,
    specCall: values.get("spec-call") as string,
    output: values.get("output") as string,
  };
}

async function main() {
  const options = cliOptions(process.argv.slice(2));
  if (!options.output || !isAbsolute(options.output))
    throw new Error("output must be an absolute path");
  const proof = await buildNativeReviewProof(options);
  await mkdir(dirname(options.output), { recursive: true });
  const temporary = `${options.output}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(proof, null, 2)}\n`, {
    flag: "wx",
  });
  await rename(temporary, options.output);
  console.log(options.output);
}

if (import.meta.main) await main();
