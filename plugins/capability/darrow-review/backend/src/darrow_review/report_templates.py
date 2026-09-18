"""Markdown layouts; callers supply escaped text and rendered sections."""

from string import Template

COMPREHENSIVE = Template("""# Code review — $title

**Verdict:** $verdict · **Findings:** $total ($blocking blocking, $advisory advisory)

## Findings
$findings

## Checks
$checks

## Risks
$risks

## Next action
$next_action

## Scope
- **Base:** $base
- **Target:** $target
- **Changed files:**$changed_files

## Sources
- **Standards ($standards):**
$standards_sources
- **Spec ($spec):** $spec_source
""")

VERIFICATION = Template("""# Repair verification — $title

**Outcome:** $outcome · Original findings: $total · Resolved: $resolved · Unresolved: $unresolved · Blocked: $blocked · Regressions: $regression_count

## Attempted findings
$attempted_findings

## Repair-caused regressions
$regressions

## Checks
$checks

## Evidence gaps
$evidence_gaps

## Target binding
$target_binding

## Closed original finding set$closed_findings

## Next action
$next_action
""")

FINDING = Template("""### $index. $severity — $disposition ($axis)
- **Location:** $location
- **Source:** $source
- **Evidence:** $evidence$guidance""")

ATTEMPT = Template("""### $index. $identity — $status / $progress ($severity, $disposition)
- **Location:** $location
- **Source:** $source
- **Original evidence:** $original_evidence$guidance
- **Current evidence:** $current_evidence""")

REGRESSION = Template("""### $index. $identity — $status / $progress ($severity)
- **Axis:** $axis
- **Caused by:** $cause
- **Location:** $location
- **Source:** $source
- **Evidence:** $evidence$guidance""")

TARGET_BINDING = Template("""- **Original target:** $original
- **Prior target:** $prior
- **Current target:** $current
- **Previous verification checksum:** $checksum
- **Previous verification artifact:** $artifact$earlier_targets""")
