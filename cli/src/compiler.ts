import { cp, mkdir, readdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import semver from "semver";
import { DarrowError } from "./errors";
import {
  canonicalJson,
  copyTree,
  exists,
  hashDirectory,
  hashFile,
  listFiles,
  makeReadOnly,
  readJson,
  sha256,
  writeJson,
} from "./io";
import {
  BUNDLED_PROFILES_DIR,
  BUNDLED_WORKFLOWS_DIR,
  SCHEMAS_DIR,
  userDarrowHome,
} from "./paths";
import { loadCatalog, resolveCapability, resolveCommand } from "./catalog";
import { run } from "./process";
import { readYaml, validateExternalSchema, validateSchema } from "./schema";
import type {
  CommandMetadata,
  ProfileDefinition,
  ProjectDefinition,
  ResolvedPlan,
  Scope,
  SkillCandidate,
  WorkflowDefinition,
} from "./types";

interface Located {
  path: string;
  scope: Scope;
}

async function selectFile(
  idOrPath: string,
  repoRoot: string,
  kind: "workflow" | "profile",
): Promise<Located> {
  const explicit = resolve(idOrPath);
  if (await exists(explicit)) return { path: explicit, scope: "explicit" };
  const roots: Array<{ path: string; scope: Scope }> =
    kind === "workflow"
      ? [
          { path: resolve(repoRoot, ".darrow", "workflows"), scope: "project" },
          { path: resolve(userDarrowHome(), "workflows"), scope: "user" },
          { path: BUNDLED_WORKFLOWS_DIR, scope: "bundled" },
        ]
      : [
          { path: resolve(repoRoot, ".darrow", "profiles"), scope: "project" },
          { path: resolve(userDarrowHome(), "profiles"), scope: "user" },
          { path: BUNDLED_PROFILES_DIR, scope: "bundled" },
        ];
  for (const root of roots) {
    if (!(await exists(root.path))) continue;
    const entries = (await readdir(root.path)).filter(
      (entry) =>
        [".yaml", ".yml"].includes(extname(entry)) &&
        basename(entry, extname(entry)) === idOrPath,
    );
    if (entries.length === 0) continue;
    if (entries.length > 1)
      throw new DarrowError(
        `ambiguous ${kind} ${idOrPath} in ${root.scope} scope`,
        "resolution",
      );
    return { path: resolve(root.path, entries[0]!), scope: root.scope };
  }
  throw new DarrowError(`${kind} not found: ${idOrPath}`, "resolution");
}

function resolveInput(
  value: unknown,
  inputs: Record<string, unknown>,
): unknown {
  if (typeof value === "string") {
    const match = /^\$\{inputs\.([a-z][a-z0-9-]*)\}$/.exec(value);
    return match ? inputs[match[1]!] : value;
  }
  if (Array.isArray(value))
    return value.map((item) => resolveInput(item, inputs));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveInput(item, inputs),
      ]),
    );
  return value;
}

function validateInputs(
  workflow: WorkflowDefinition,
  inputs: Record<string, unknown>,
): void {
  for (const key of Object.keys(inputs))
    if (!(key in workflow.inputs))
      throw new DarrowError(`unknown workflow input: ${key}`, "validation");
  for (const [key, definition] of Object.entries(workflow.inputs)) {
    const value = inputs[key];
    if (definition.required && value === undefined)
      throw new DarrowError(
        `missing required workflow input: ${key}`,
        "validation",
      );
    if (value !== undefined && typeof value !== definition.type)
      throw new DarrowError(
        `workflow input ${key} must be ${definition.type}`,
        "validation",
      );
  }
}

export function validateWorkflowGraph(workflow: WorkflowDefinition): void {
  const steps = new Map<string, WorkflowDefinition["steps"][number]>();
  for (const step of workflow.steps) {
    if (steps.has(step.id))
      throw new DarrowError(
        `duplicate workflow step ID: ${step.id}`,
        "validation",
      );
    steps.set(step.id, step);
  }

  for (const step of workflow.steps) {
    for (const dependency of step.dependsOn) {
      if (dependency === step.id)
        throw new DarrowError(
          `workflow step ${step.id} cannot depend on itself`,
          "validation",
        );
      if (!steps.has(dependency))
        throw new DarrowError(
          `workflow step ${step.id} depends on unknown step ${dependency}`,
          "validation",
        );
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (stepId: string, path: string[]): void => {
    if (visited.has(stepId)) return;
    if (visiting.has(stepId)) {
      const start = path.indexOf(stepId);
      const cycle = [...path.slice(start), stepId];
      throw new DarrowError(
        `workflow dependency cycle: ${cycle.join(" -> ")}`,
        "validation",
      );
    }
    visiting.add(stepId);
    const step = steps.get(stepId)!;
    for (const dependency of step.dependsOn)
      visit(dependency, [...path, stepId]);
    visiting.delete(stepId);
    visited.add(stepId);
  };

  for (const step of workflow.steps) visit(step.id, []);

  const loopIds = new Set<string>();
  const waiverIds = new Set<string>();
  const membership = new Map<string, string>();
  for (const loop of workflow.loops) {
    if (loopIds.has(loop.id))
      throw new DarrowError(
        `duplicate workflow loop ID: ${loop.id}`,
        "validation",
      );
    loopIds.add(loop.id);
    if (loop.waiver) {
      if (waiverIds.has(loop.waiver.id))
        throw new DarrowError(
          `duplicate workflow waiver ID: ${loop.waiver.id}`,
          "validation",
        );
      waiverIds.add(loop.waiver.id);
    }
    for (const stepId of loop.steps) {
      if (!steps.has(stepId))
        throw new DarrowError(
          `workflow loop ${loop.id} contains unknown step ${stepId}`,
          "validation",
        );
      const prior = membership.get(stepId);
      if (prior)
        throw new DarrowError(
          `workflow step ${stepId} belongs to loops ${prior} and ${loop.id}`,
          "validation",
        );
      membership.set(stepId, loop.id);
    }
    const last = loop.steps.at(-1)!;
    if (loop.until.stepId !== last)
      throw new DarrowError(
        `workflow loop ${loop.id} outcome must be produced by its final step ${last}`,
        "validation",
      );
    for (let index = 1; index < loop.steps.length; index += 1) {
      const stepId = loop.steps[index]!;
      const previous = loop.steps[index - 1]!;
      const dependencies = steps.get(stepId)!.dependsOn;
      if (dependencies.length !== 1 || dependencies[0] !== previous)
        throw new DarrowError(
          `workflow loop ${loop.id} must be a linear region; ${stepId} must depend only on ${previous}`,
          "validation",
        );
    }
    if (loop.waiver?.instructionsTo) {
      const target = steps.get(loop.waiver.instructionsTo);
      if (!target)
        throw new DarrowError(
          `workflow loop ${loop.id} forwards waiver instructions to unknown step ${loop.waiver.instructionsTo}`,
          "validation",
        );
      if (
        membership.get(target.id) === loop.id ||
        !target.dependsOn.includes(last)
      )
        throw new DarrowError(
          `workflow loop ${loop.id} may forward waiver instructions only to a direct dependent outside the loop`,
          "validation",
        );
    }
  }
  for (const step of workflow.steps) {
    const loopId = membership.get(step.id);
    if (loopId) continue;
    for (const dependency of step.dependsOn) {
      const dependencyLoop = membership.get(dependency);
      if (!dependencyLoop) continue;
      const loop = workflow.loops.find((item) => item.id === dependencyLoop)!;
      if (dependency !== loop.steps.at(-1))
        throw new DarrowError(
          `workflow step ${step.id} must depend on final step ${loop.steps.at(-1)} of loop ${loop.id}`,
          "validation",
        );
    }
  }
}

export function orderWorkflowSteps(
  workflow: WorkflowDefinition,
): WorkflowDefinition["steps"] {
  const ordered: WorkflowDefinition["steps"] = [];
  const emitted = new Set<string>();
  while (ordered.length < workflow.steps.length) {
    const ready = workflow.steps.filter(
      (step) =>
        !emitted.has(step.id) &&
        step.dependsOn.every((dependency) => emitted.has(dependency)),
    );
    if (ready.length === 0)
      throw new DarrowError(
        "validated workflow graph has no topological order",
        "validation",
      );
    for (const step of ready) {
      ordered.push(step);
      emitted.add(step.id);
    }
  }
  return ordered;
}

export interface Compilation {
  plan: ResolvedPlan;
  workflow: WorkflowDefinition;
  profile: ProfileDefinition;
  workflowFile: Located;
  profileFile: Located;
  commands: SkillCandidate[];
  capabilities: SkillCandidate[];
  project: ProjectDefinition;
}

export async function verifyResolvedPlan(plan: ResolvedPlan): Promise<void> {
  await validateSchema("resolved-plan.schema.json", plan, "resolved plan");
  const { digest, ...base } = plan;
  if (sha256(canonicalJson(base)) !== digest)
    throw new DarrowError(
      "resolved plan digest does not match its content",
      "immutable_violation",
    );
}

export async function verifyRunSnapshot(
  runDir: string,
  plan: ResolvedPlan,
): Promise<void> {
  await verifyResolvedPlan(plan);
  const lock = await import("./io").then(({ readJson }) =>
    readJson<Record<string, any>>(resolve(runDir, "lock.json")),
  );
  await validateSchema("lock.schema.json", lock, "run lock");
  if (lock.planDigest !== plan.digest)
    throw new DarrowError(
      "run lock does not anchor the resolved plan",
      "immutable_violation",
    );
  const root = resolve(runDir, "snapshot");
  const manifest = await import("./io").then(({ readJson }) =>
    readJson<Record<string, any>>(resolve(root, "manifest.json")),
  );
  await validateSchema(
    "snapshot-manifest.schema.json",
    manifest,
    "snapshot manifest",
  );
  const snapshotPlan = await import("./io").then(({ readJson }) =>
    readJson<ResolvedPlan>(resolve(root, "plan.json")),
  );
  await verifyResolvedPlan(snapshotPlan);
  if (
    snapshotPlan.digest !== plan.digest ||
    manifest.plan !== (await hashFile(resolve(root, "plan.json")))
  )
    throw new DarrowError(
      "snapshot plan does not match the locked plan",
      "immutable_violation",
    );
  if (
    manifest.workflow !== lock.workflow.digest ||
    (await hashFile(resolve(root, "workflow.yaml"))) !== lock.workflow.digest
  )
    throw new DarrowError(
      "snapshot workflow digest mismatch",
      "immutable_violation",
    );
  if (
    manifest.profile !== lock.profile.digest ||
    (await hashFile(resolve(root, "profile.yaml"))) !== lock.profile.digest
  )
    throw new DarrowError(
      "snapshot profile digest mismatch",
      "immutable_violation",
    );
  if (manifest.schemas !== (await hashDirectory(resolve(root, "schemas"))))
    throw new DarrowError(
      "snapshot schema tree digest mismatch",
      "immutable_violation",
    );
  for (const schema of lock.schemas as Array<{
    identity: string;
    location: string;
    digest: string;
  }>) {
    if ((await hashFile(resolve(root, schema.location))) !== schema.digest)
      throw new DarrowError(
        `snapshot schema digest mismatch: ${schema.identity}`,
        "immutable_violation",
      );
  }
  for (const command of lock.commands as Array<{
    id: string;
    digest: string;
  }>) {
    const [plugin, skill] = command.id.split(":");
    if (
      manifest.commands[command.id] !== command.digest ||
      (await hashDirectory(resolve(root, "commands", plugin!, skill!))) !==
        command.digest
    )
      throw new DarrowError(
        `snapshot command digest mismatch: ${command.id}`,
        "immutable_violation",
      );
  }
  for (const capability of lock.capabilities as Array<{
    providerId: string;
    digest: string;
  }>) {
    const [plugin, skill] = capability.providerId.split(":");
    if (
      manifest.capabilities[capability.providerId] !== capability.digest ||
      (await hashDirectory(resolve(root, "capabilities", plugin!, skill!))) !==
        capability.digest
    )
      throw new DarrowError(
        `snapshot capability digest mismatch: ${capability.providerId}`,
        "immutable_violation",
      );
  }
}

export async function compile(
  repoRoot: string,
  workflowName: string,
  inputs: Record<string, unknown>,
): Promise<Compilation> {
  const project = await readYaml<ProjectDefinition>(
    resolve(repoRoot, ".darrow", "project.yaml"),
    "project.schema.json",
  );
  const workflowFile = await selectFile(workflowName, repoRoot, "workflow");
  const workflow = await readYaml<WorkflowDefinition>(
    workflowFile.path,
    "workflow.schema.json",
  );
  if (!semver.satisfies("0.1.0", workflow.engine))
    throw new DarrowError(
      `workflow requires engine ${workflow.engine}, installed engine is 0.1.0`,
      "compatibility",
    );
  validateWorkflowGraph(workflow);
  const orderedSteps = orderWorkflowSteps(workflow);
  validateInputs(workflow, inputs);
  const profileFile = await selectFile(
    workflow.profile || project.defaultProfile,
    repoRoot,
    "profile",
  );
  const profile = await readYaml<ProfileDefinition>(
    profileFile.path,
    "profile.schema.json",
  );
  const catalog = await loadCatalog(repoRoot, project);
  const commands = orderedSteps.map((step) =>
    resolveCommand(catalog, step.command.id, step.command.version),
  );
  for (let index = 0; index < orderedSteps.length; index += 1) {
    const command = commands[index]!;
    const metadata = command.metadata as CommandMetadata;
    const resolvedInput = resolveInput(
      orderedSteps[index]!.with,
      inputs,
    ) as Record<string, unknown>;
    await validateExternalSchema(
      resolve(command.skillDir, metadata.inputSchema),
      resolvedInput,
      `input for ${command.id}`,
    );
  }
  for (const loop of workflow.loops) {
    const outcomeIndex = orderedSteps.findIndex(
      (step) => step.id === loop.until.stepId,
    );
    const command = commands[outcomeIndex]!;
    const metadata = command.metadata as CommandMetadata;
    const outputSchema = await readJson<{
      required?: unknown;
      properties?: Record<string, { type?: string | string[] }>;
    }>(resolve(command.skillDir, metadata.outputSchema));
    const property = outputSchema.properties?.[loop.until.output];
    const required = Array.isArray(outputSchema.required)
      ? outputSchema.required
      : [];
    const types = Array.isArray(property?.type)
      ? property.type
      : property?.type
        ? [property.type]
        : [];
    if (
      !required.includes(loop.until.output) ||
      !property ||
      types.length === 0 ||
      types.some(
        (type) =>
          !["string", "number", "integer", "boolean", "null"].includes(type),
      )
    )
      throw new DarrowError(
        `workflow loop ${loop.id} outcome ${loop.until.output} must be a required scalar output of ${loop.until.stepId}`,
        "validation",
      );
  }
  const requirements = new Map<string, string>();
  for (const requirement of workflow.requirements.capabilities)
    requirements.set(requirement.contract, requirement.version);
  for (const command of commands) {
    const metadata = command.metadata as CommandMetadata;
    for (const requirement of metadata.requires ?? []) {
      const current = requirements.get(requirement.contract);
      if (current && current !== requirement.version)
        throw new DarrowError(
          `conflicting ranges for ${requirement.contract}: ${current} and ${requirement.version}`,
          "preflight",
        );
      requirements.set(requirement.contract, requirement.version);
    }
  }
  const resolvedCapabilities = [...requirements].map(([contract, range]) => ({
    contract,
    range,
    ...resolveCapability(catalog, contract, range),
  }));
  const planBase = {
    schemaVersion: "0.1.0" as const,
    engineVersion: "0.1.0" as const,
    workflow: {
      id: workflow.id,
      version: workflow.version,
      source: resolve(workflowFile.path),
      scope: workflowFile.scope,
      digest: await hashFile(workflowFile.path),
    },
    profile: {
      ...profile,
      source: resolve(profileFile.path),
      digest: await hashFile(profileFile.path),
    },
    capabilities: resolvedCapabilities.map(
      ({ contract, range, version, candidate }) => ({
        contract,
        requested: range,
        version,
        providerId: candidate.id,
        pluginVersion: candidate.pluginVersion,
        scope: candidate.scope,
        source: candidate.skillDir,
        digest: candidate.digest,
      }),
    ),
    loops: workflow.loops,
    steps: orderedSteps.map((step, index) => {
      const command = commands[index]!;
      const metadata = command.metadata as CommandMetadata;
      return {
        id: step.id,
        dependsOn: step.dependsOn,
        commandId: command.id,
        contractVersion: metadata.contractVersion,
        source: command.skillDir,
        digest: command.digest,
        input: resolveInput(step.with, inputs) as Record<string, unknown>,
      };
    }),
    inputs,
  };
  const plan: ResolvedPlan = {
    ...planBase,
    digest: sha256(canonicalJson(planBase)),
  };
  await verifyResolvedPlan(plan);
  const uniqueCommands = commands.filter(
    (command, index, all) =>
      all.findIndex((candidate) => candidate.id === command.id) === index,
  );
  return {
    plan,
    workflow,
    profile,
    workflowFile,
    profileFile,
    commands: uniqueCommands,
    capabilities: resolvedCapabilities.map((item) => item.candidate),
    project,
  };
}

export async function snapshot(
  compilation: Compilation,
  runDir: string,
): Promise<string> {
  const root = resolve(runDir, "snapshot");
  await mkdir(root, { recursive: false });
  await cp(compilation.workflowFile.path, resolve(root, "workflow.yaml"), {
    errorOnExist: true,
  });
  await cp(compilation.profileFile.path, resolve(root, "profile.yaml"), {
    errorOnExist: true,
  });
  await copyTree(SCHEMAS_DIR, resolve(root, "schemas"));
  for (const command of compilation.commands)
    await copyTree(
      command.skillDir,
      resolve(root, "commands", command.pluginName, command.skillName),
    );
  for (const capability of compilation.capabilities)
    await copyTree(
      capability.skillDir,
      resolve(
        root,
        "capabilities",
        capability.pluginName,
        capability.skillName,
      ),
    );
  await writeJson(resolve(root, "plan.json"), compilation.plan);
  const copiedWorkflow = resolve(root, "workflow.yaml");
  const copiedProfile = resolve(root, "profile.yaml");
  if ((await hashFile(copiedWorkflow)) !== compilation.plan.workflow.digest)
    throw new DarrowError(
      "workflow changed while its snapshot was created",
      "immutable_violation",
    );
  if ((await hashFile(copiedProfile)) !== compilation.plan.profile.digest)
    throw new DarrowError(
      "profile changed while its snapshot was created",
      "immutable_violation",
    );
  for (const command of compilation.commands) {
    const copied = resolve(
      root,
      "commands",
      command.pluginName,
      command.skillName,
    );
    if ((await hashDirectory(copied)) !== command.digest)
      throw new DarrowError(
        `command changed while its snapshot was created: ${command.id}`,
        "immutable_violation",
      );
  }
  for (const capability of compilation.capabilities) {
    const copied = resolve(
      root,
      "capabilities",
      capability.pluginName,
      capability.skillName,
    );
    if ((await hashDirectory(copied)) !== capability.digest)
      throw new DarrowError(
        `capability changed while its snapshot was created: ${capability.id}`,
        "immutable_violation",
      );
  }
  await writeJson(resolve(root, "manifest.json"), {
    schemaVersion: "0.1.0",
    workflow: compilation.plan.workflow.digest,
    profile: compilation.plan.profile.digest,
    commands: Object.fromEntries(
      compilation.commands.map((item) => [item.id, item.digest]),
    ),
    capabilities: Object.fromEntries(
      compilation.capabilities.map((item) => [item.id, item.digest]),
    ),
    schemas: await hashDirectory(resolve(root, "schemas")),
    plan: await hashFile(resolve(root, "plan.json")),
  });
  await makeReadOnly(root);
  return root;
}

export async function createLock(
  compilation: Compilation,
  runId: string,
): Promise<Record<string, unknown>> {
  const cliSchemas = await Promise.all(
    (await listFiles(SCHEMAS_DIR)).map(async (path) => ({
      identity: `darrow:${basename(path)}`,
      version: "0.1.0",
      location: `schemas/${basename(path)}`,
      digest: await hashFile(path),
    })),
  );
  const commandSchemas = (
    await Promise.all(
      compilation.commands.flatMap((candidate) => {
        const metadata = candidate.metadata as CommandMetadata;
        return [metadata.inputSchema, metadata.outputSchema].map(
          async (schemaPath) => ({
            identity: `${candidate.id}:${basename(schemaPath)}`,
            version: metadata.contractVersion,
            location: `commands/${candidate.pluginName}/${candidate.skillName}/${schemaPath.replace(/^\.\//, "")}`,
            digest: await hashFile(resolve(candidate.skillDir, schemaPath)),
          }),
        );
      }),
    )
  ).filter(
    (item, index, all) =>
      all.findIndex((other) => other.identity === item.identity) === index,
  );
  const schemas = [...cliSchemas, ...commandSchemas];
  const codexExecutable = Bun.which("codex");
  const detectedCodex = codexExecutable
    ? run([codexExecutable, "--version"])
    : null;
  const codexHome =
    process.env.CODEX_HOME ??
    (process.env.HOME ? resolve(process.env.HOME, ".codex") : null);
  const codexConfig = codexHome ? resolve(codexHome, "config.toml") : null;
  const nativePermissions =
    codexConfig && (await exists(codexConfig))
      ? {
          inherit: true,
          configurationSource: codexConfig,
          configurationDigest: await hashFile(codexConfig),
        }
      : {
          inherit: true,
          configurationSource: "environment-defaults",
          configurationDigest: sha256("environment-defaults"),
        };
  const temporalManifest = resolve(import.meta.dir, "..", "temporal.json");
  const lock = {
    schemaVersion: "0.1.0",
    runId,
    createdAt: new Date().toISOString(),
    versions: {
      engine: "0.1.0",
      cliProtocol: "0.1.0",
      workflowSchema: "0.1.0",
    },
    planDigest: compilation.plan.digest,
    workflow: compilation.plan.workflow,
    commands: compilation.commands.map((candidate) => ({
      id: candidate.id,
      contractVersion: (candidate.metadata as CommandMetadata).contractVersion,
      pluginVersion: candidate.pluginVersion,
      source: candidate.skillDir,
      digest: candidate.digest,
    })),
    capabilities: compilation.plan.capabilities,
    profile: compilation.plan.profile,
    schemas,
    builtins: [
      {
        name: "temporal",
        version: "1.8.0",
        digest: await hashFile(temporalManifest),
      },
    ],
    adapter: {
      id: "codex-cli",
      version: "0.1.0",
      executable: codexExecutable ?? "unavailable",
      detectedVersion:
        detectedCodex?.exitCode === 0
          ? detectedCodex.stdout.trim()
          : "unavailable",
      harness: "codex",
      provider: compilation.profile.provider,
      model: compilation.profile.model,
      reasoningEffort: compilation.profile.reasoningEffort,
      nativePermissions,
    },
    engine: {
      id: "darrow",
      version: "0.1.0",
      digest: await hashDirectory(resolve(import.meta.dir)),
    },
  };
  await validateSchema("lock.schema.json", lock, "run lock");
  return lock;
}
