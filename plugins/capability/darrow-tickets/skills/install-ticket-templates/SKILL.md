---
name: install-ticket-templates
description: Install Darrow's reusable GitHub issue templates for dependency upgrades, retirement, and bug fixes with regression coverage into a named repository. Use when asked to adopt or install these templates. Do not select for creating a ticket, editing an individual issue, or delivering the work in a ticket.
---

# Install ticket templates

Add the bundled GitHub issue templates to one target repository while preserving
its existing templates and customizations. This changes local repository files;
it does not create issues or start delivery.

## 1. Identify the target

Use the repository explicitly named by the user, or the current repository when
the request says “here” or otherwise clearly refers to it. Resolve its absolute
root. Ask for the target if more than one repository could be meant. Do not
infer a different repository from an issue URL or another plugin's files.

**Complete when:** one target repository root and the user's installation
request are established.

## 2. Install the bundled files

Run the contained package through its frozen runtime entrypoint. `<skill-dir>`
is the absolute directory containing this `SKILL.md`:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-ticket-templates install --repo <absolute-repository-root>
```

The command creates only absent `dependency-upgrade.md`, `retirement.md`, and
`bug-fix-regression.md` files under `.github/ISSUE_TEMPLATE/`. It reports each
absolute path as `created`, `unchanged`, or `preserved`. A differing file,
symlink, directory, or unrelated repository template is never overwritten.
An existing case-variant filename that blocks a bundled path causes a refusal.
Treat an error as a refusal and report it; do not copy files manually, delete a
customization, or retry under a different path.

**Complete when:** the command has reported the state of all three template
paths, or its refusal has been returned without a replacement write.

## 3. Report the local result

Report the created, unchanged, and preserved absolute paths returned by the
command, including any customization
that needs human review before the bundled version can be adopted. Do not
commit, push, create a ticket, invoke `ticket-to-pr`, or claim the templates are
available in GitHub's issue chooser until they reach the repository's default
branch through separately authorized work.

**Complete when:** the user can see exactly which local files changed and which
existing files were left alone.
