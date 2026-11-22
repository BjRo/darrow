# Darrow

<p align="center">
  <img src="docs/assets/darrow-logo.png" alt="Darrow logo" width="420">
</p>

<a id="why-darrow"></a>

Darrow adds reusable workflows to Codex and Claude Code. Install a plugin for
focused work such as Git or review, or explicitly invoke a delivery workflow
that coordinates a larger request.

Start with one plugin. Focused capabilities match your request; orchestration
requires explicit invocation and keeps one native execution owner. Selected
upstream workflows also require explicit invocation. Use the
[current catalog](docs/choosing-plugins.md) to choose, then follow the
[installation and update guide](docs/installing-plugins.md).

Codex is the primary development host. Both hosts are required targets for the
curated bundles and shared workflows, but support claims depend on each
workflow's evidence.

<a id="status-and-compatibility"></a>

Darrow is actively developed; check [host requirements and verification limits](docs/installing-plugins.md#prerequisites)
before installing or updating.

## Get started

<a id="see-it-in-action"></a>

Try the [read-only readiness tutorial](docs/getting-started.md): install one
plugin, assess a small request, and inspect its verdict without editing code.
The [installation guide](docs/installing-plugins.md) covers each host, updates,
removal, verification, and recovery.

## Ask the guide

Open this checkout in a fresh session and ask "What is Darrow?" Use
`$darrow-guide` in Codex or `/darrow-guide` in Claude Code to invoke it explicitly.
The guide reads repository sources and explains them without running work.

Prefer browsing? The [documentation hub](docs/README.md) works without an agent.

## The five layers

<a id="automation"></a>

Foundations, capabilities, orchestration, task recipes, and explicit automation
describe responsibilities, not a mandatory sequence.

<p align="center">
  <img src="docs/assets/darrow-plugin-layers.svg" alt="Five Darrow responsibility layers and their supporting relationships.">
</p>

[Read the diagram's equivalent text description](docs/choosing-plugins.md#understand-the-layers).

<a id="plugin-catalog"></a>

## Choose your next plugin

Choose by task in the [catalog](docs/choosing-plugins.md). Each plugin README
explains its prerequisites, usage and safety boundaries.

<a id="foundations"></a>[Foundations](plugins/foundation/README.md) ·
<a id="capabilities"></a>[Capabilities](plugins/capability/README.md) ·
<a id="orchestration"></a>[Orchestration](plugins/orchestration/README.md) ·
<a id="task-recipes"></a>[Task recipes](plugins/task-recipe/README.md) ·
[Automation](plugins/automation/README.md)

## Explore and contribute

<a id="how-darrow-works"></a>

[Design principles](docs/design.md) explain ownership and architectural choices. For problems, start with
[troubleshooting](docs/troubleshooting.md).

<a id="repository-reference"></a>
<a id="development"></a>

For changes, read [Contributing](CONTRIBUTING.md) and
[plugin development](docs/plugin-development.md). [ADRs](docs/decisions/README.md)
record architectural choices and their rationale.

<a id="standing-on-the-shoulders-of-giants"></a>

[Acknowledgements](docs/acknowledgements.md) credit the projects and people behind Darrow's ideas.

## License

The complete [Matt Pocock](plugins/capability/darrow-matt-pocock/LICENSE) and
[pstack](plugins/capability/darrow-pstack/LICENSE) bundles, including moved Darrow
adaptations, are MIT licensed. Their full author notices and pinned provenance
ship with each package. Other Darrow material remains source-available under the
[Business Source License 1.1](LICENSE), with the Mozilla Public License 2.0 as
the Change License. **Each released version of the BUSL material becomes MPL-2.0 two years after
it is published.**

For the BUSL portion: free for internal use, client work, research, personal projects,
and teaching without commercial interest. Commercial education and offering
Darrow's functionality as a product or service require a commercial license.

The standard BSL terms permit copying, modification, redistribution, and all
non-production use.

Additional production use that is free, without asking:

- Use Darrow within your own organization for purposes other than commercial
  education.
- Use it in client work that is not commercial education.
- Use it to teach third parties, run workshops or courses, give talks or
  presentations, and publish blog posts or articles when the activity has no
  commercial interest.
- Use it in research, evaluation, and personal projects.

Not included in the free production-use grant:

- Use Darrow in education with a commercial interest, whether the audience is
  inside or outside your organization. That includes compensation or
  sponsorship, bundling with or promoting paid offerings, lead generation, and
  other direct or indirect commercial benefits.
- Offer Darrow, or a derivative of it, to third parties as a product or service
  whose principal value is Darrow's functionality.

Under the BSL terms, production use outside the Additional Use Grant requires
you to purchase a commercial license or refrain from that use. For commercial
licensing, contact bjoern@bjro.de.

Production-use grants are version-specific. Earlier versions remain available
under the Additional Use Grant distributed with those versions.

Curated-bundle contributions use MIT; other contributions use Apache-2.0 plus
a relicensing grant. See
[CONTRIBUTING.md](CONTRIBUTING.md).
