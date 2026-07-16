# Specification: Compatibility, Resolution, and Locking

Defines Darrow's independent version axes, semantic-version rules, scoped
resolution, skill metadata, immutable run locks and snapshots, local trust, and
release gates.

Read [workflow runtime](workflow-runtime.md) for execution behavior and
[workspaces and artifacts](workspaces-artifacts.md) for snapshot storage.

## Independent version axes

- **CP-1 — Independent compatibility.** These versions change independently and
  appear separately in metadata and run locks:

| Axis                          | Identifies                                                                 |
| ----------------------------- | -------------------------------------------------------------------------- |
| `engine_version`              | Darrow interpreter behavior and backend integration.                       |
| `cli_protocol_version`        | Commands, structured help, input/output, continuation, and exit semantics. |
| `workflow_schema_version`     | Accepted workflow syntax and its meaning.                                  |
| `workflow_version`            | One workflow's behavior and public input/output contract.                  |
| `command_contract_version`    | One explicitly invoked command's typed behavior.                           |
| `capability_contract_version` | One portable intent-based behavioral guarantee.                            |
| `plugin_version`              | One distributed plugin package and its contents.                           |

- **CP-2 — Versions express compatibility; digests express identity.** Semantic
  versions say which consumers may interoperate. A cryptographic content digest
  identifies exact resolved bytes. Neither substitutes for the other.
- **CP-3 — Package and contract versions differ.** A plugin package version does
  not imply the versions of the command and capability contracts it contains.
  Every contract declares its own version.
- **CP-4 — Every shipped change is versioned.** A shipped content change bumps at
  least the owning plugin or workflow patch version, even if no public contract
  changes.

## Semantic-version policy

- **CP-5 — Engine bumps.** Patch fixes implementation without changing declared
  behavior. Minor adds backward-compatible behavior. Major breaks engine
  behavior or drops supported contracts.
- **CP-6 — CLI protocol bumps.** Patch corrects behavior within the existing
  protocol. Minor adds optional commands, fields, or statuses that compatible
  clients may ignore. Major removes or renames data, changes a type or exit
  meaning, or requires new input.
- **CP-7 — Workflow schema bumps.** Patch changes documentation, diagnostics, or
  validation without changing accepted meaning. Minor accepts additional syntax
  while preserving all previously valid workflows. Major makes previously valid
  workflows invalid or changes their meaning.
- **CP-8 — Workflow bumps.** Patch fixes behavior within existing public inputs,
  outputs, permission needs, and side-effect classes. Minor adds optional
  compatible behavior. Major changes required input/output, permissions,
  side-effect class, or default outcome.
- **CP-9 — Command contract bumps.** Patch is a behavior-preserving correction.
  Minor adds optional data or a stronger compatible guarantee. Major adds a
  requirement, removes or changes data, changes side-effect class, or weakens a
  guarantee.
- **CP-10 — Capability contract bumps.** Patch clarifies or fixes an
  implementation without changing the guarantee. Minor adds a compatible
  guarantee. Major removes, weakens, or incompatibly changes a guarantee.
- **CP-11 — Plugin bumps.** Patch changes compatible implementation or
  documentation. Minor adds a compatible skill or contract implementation. Major
  removes or renames a skill or makes packaging incompatible.
- **CP-12 — Conservative ambiguity.** Unknown JSON fields are compatible only
  where the schema and client contract explicitly say they are ignored. Adding
  an enum member is not automatically compatible. If reviewers cannot prove the
  lower bump is safe, use the higher bump.

CI may verify schema diffs, manifest consistency, and version formatting.
Humans remain responsible for semantic classification of behavior changes.

## Canonical identities

- **CP-13 — Command ID.** A command's canonical ID is
  `<plugin-name>:<skill-name>`, derived from the selected native plugin manifest
  and skill-directory basename. The ID contains no version. Workflows express a
  version range separately. There is no command alias or intent-resolution layer.
- **CP-14 — Command rename is breaking.** Changing the plugin name or command
  skill directory changes the canonical ID and requires a major compatibility
  transition.
- **CP-15 — Capability contract ID.** A capability provider has its native skill
  identity but advertises one or more portable contract IDs such as
  `tickets.create` or `git.commit.create`. Workflows require the portable ID and
  version range, never the provider identity.
- **CP-16 — Provider plurality.** Several native skills may provide the same
  capability contract. Environment configuration selects the eligible provider;
  Darrow does not add an alias registry.

## Darrow skill metadata

Every Darrow-aware skill contains `darrow.json` beside `SKILL.md`. The native
Claude Code and Codex manifests continue to own plugin identity and package
version. The authoritative machine-readable schema is
[darrow-skill-metadata.schema.json](darrow-skill-metadata.schema.json).
This metadata becomes mandatory when a skill participates in the M1 workflow
runtime; existing M0 skills remain ordinary harness skills until migrated.

- **CP-17 — No duplicated identity.** `darrow.json` does not repeat the plugin or
  skill name. Darrow derives both from the selected runtime package.
- **CP-18 — Strict schema.** Darrow rejects an unknown field, invalid semantic
  version or range, unreadable schema, absolute schema path, or relative schema
  path that escapes the skill directory.
- **CP-19 — Ordinary skills remain ordinary.** A harness skill without
  `darrow.json` remains usable by that harness but is absent from Darrow command
  resolution and capability preflight.

Command metadata has this shape:

```json
{
  "schemaVersion": 1,
  "kind": "command",
  "contractVersion": "1.0.0",
  "inputSchema": "./input.schema.json",
  "outputSchema": "./output.schema.json",
  "cancellation": "wait_for_boundary",
  "requires": [
    {
      "contract": "tickets.create",
      "version": "^1.0.0"
    }
  ]
}
```

`requires` contains hard capability requirements and may be omitted when empty.
Optional capabilities are expressed only through natural-language intent and
therefore do not appear here. `cancellation` may be `wait_for_boundary` or
`interrupt`; omission safely defaults to `wait_for_boundary`. A command may
declare `interrupt` only when terminating its active invocation at that boundary
is safe according to the command's checkpoint contract.

Capability metadata has this shape:

```json
{
  "schemaVersion": 1,
  "kind": "capability",
  "provides": [
    {
      "contract": "tickets.create",
      "version": "1.0.0"
    }
  ]
}
```

- **CP-20 — Metadata schema version.** `schemaVersion` versions the metadata file
  shape, not a command or capability contract. Darrow must understand it before
  considering the skill eligible.
- **CP-21 — Exact implementation claims.** `contractVersion` and each
  `provides[].version` are exact semantic versions. Workflow and command
  requirements use semantic-version ranges.
- **CP-22 — Relative schema ownership.** Command input and output schemas resolve
  relative to the skill directory and remain inside it. They ship in the same
  self-contained plugin.

## Scoped resolution

- **CP-23 — Scope precedence.** Workflow and Darrow-aware skill resolution uses:

  ```text
  explicit path or override > project > user > bundled defaults
  ```

- **CP-24 — First matching scope wins.** Darrow examines one scope at a time. The
  first scope containing an identity match wins; lower scopes cannot influence
  the choice. An incompatible selected candidate is an error rather than a reason
  to fall through. Multiple candidates in the same scope are an ambiguity error
  unless an explicit qualifier selects one.
- **CP-25 — Intentional shadowing.** Project content may intentionally shadow
  user or bundled content. CLI inspection and preflight show selected and
  shadowed candidates, including scope, source, version, and digest.
- **CP-26 — Explicit disambiguation.** Qualified IDs and an explicit `--scope`
  or source override select content when ordinary precedence is insufficient.
- **CP-27 — No implicit acquisition.** Resolution never installs or updates a
  CLI, plugin, workflow pack, harness, model, or worker.
- **CP-28 — Multi-harness preflight.** For every harness eligible to execute a
  step, all hard command and capability requirements must be compatible, or the
  profile must disambiguate the eligible harness/provider set.

## Run lock and snapshot

- **CP-29 — Exact lock.** A run lock records at least:
  - every version axis in use;
  - workflow source, scope, version, and digest;
  - resolved command IDs, implementations, contracts, plugin versions, sources,
    and digests;
  - resolved capability contracts, eligible providers, sources, versions, and
    digests;
  - built-in names, versions, and engine digest;
  - all referenced schema identities, versions, and digests;
  - profile and model-policy digest;
  - requested harness, provider, model, reasoning configuration, and native
    permission configuration;
  - adapter and engine versions; and
  - resolved model snapshot identifier when the provider exposes one.
- **CP-30 — Local snapshot.** The exact workflow, Darrow-aware skills, bundled
  scripts, metadata, and schemas named by the lock are copied into
  `.darrow/runs/<run-id>/snapshot/`. Resume verifies their digests and invokes
  the snapshot rather than mutable installed content.
- **CP-31 — External provenance limitation.** Harness executables, provider
  services, and model weights are recorded but not snapshotted. The lock promises
  reproducible control, inputs, and provenance, not identical model output.
- **CP-32 — No silent substitution.** If a fixed harness or model is unavailable,
  the run enters `waiting_for_input`. An approved alternative is an append-only
  run amendment. A dynamic model policy may choose another candidate only when
  the original locked policy explicitly allowed that candidate.
- **CP-33 — No active-run migration contract.** A new compatible engine may read
  completed artifacts and workflows. Migrating active control state between
  local and hosted environments or incompatible engine releases is out of scope.

## Local trust and signing

- **CP-34 — Selection establishes local trust.** In the local product, a plugin
  is trusted because the user or surrounding environment installed and enabled
  it. Darrow does not maintain a second local trust decision.
- **CP-35 — Provenance is mandatory.** The lock records source location,
  publisher text when provided by the native package, package version, and
  content digest. Publisher text is informational and is not verified identity.
- **CP-36 — Signing deferred.** Cryptographic signatures, publisher identity
  verification, and a Darrow-managed trust store are deferred until hosted or
  curated distribution requires them.

## Release gates

- **CP-37 — Independent releases.** Engine, CLI, plugins, workflow packs, and
  schemas release independently subject to their declared compatibility ranges.
- **CP-38 — Required validation.** A plugin or workflow-pack release requires
  passing deterministic tests, schema and manifest validation, contract
  compatibility checks, and every applicable eval suite at its declared
  threshold.
- **CP-39 — Digest and version consistency.** Published indexes and packages must
  agree on package version and content digest. A released lock or index never
  points at mutable content.
- **CP-40 — CI mechanism is replaceable.** This specification defines release
  invariants, not a particular CI provider, publication script, or marketplace
  promotion workflow.
