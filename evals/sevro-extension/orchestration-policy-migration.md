# Legacy orchestration-policy reconciliation

The user requested no special handling for deprecated `darrow-ticket-pipeline`
and selected task results and reported counts instead of rebuilding its phase
checks. No pipeline-specific grader, instrumentation, enforcement, or launch
correction is added. The generic host and public extension contracts stay intact.

The following dispositions reconcile the remaining mixed
`evals/runner/orchestration-metrics.test.ts` examples before cutover.

| Legacy example                                              | Current disposition                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zero-child stops reject observed spawn attempts             | Public Codex and Claude non-ready checks retain actual readiness calls and absence of an owner. They do not require a serialized zero-child report.                                                                                                                |
| Activated child with unavailable native goal persistence    | Public owner evidence binds correlated native acceptance independently of goal persistence. Missing or contradictory receipts remain unavailable. No private objective/contract attestation or goal-creation machinery is restored.                                |
| Goal-loop routes, interruptions, and failed quality oracles | Recorded route applications and counts remain archival claims. Current explicit benchmark count checks validate self-reported records; named task checks independently supply escaped-defect and false-positive metrics. Private goal-loop result parsing retires. |
| No orchestration metrics for unrelated skills               | Shared benchmark count checks remain explicitly requested through configuration. An ordinary final answer does not create implicit child or interruption counts. Named task metrics retain their own case declarations.                                            |
| Neutral counts from non-orchestrated baselines              | Preserve the shared public record checks for `evaluation_child_invocations` and `evaluation_human_interruptions`. Their values remain self-reported; they do not prove native child totals.                                                                        |
| Foreign harnesses in old route formats                      | Retire usage reconstruction from private route rows. Generic host usage keeps explicit source and completeness; route claims cannot repair missing child accounting or justify a complete cross-host total. Historical fields remain archived claims.              |
| Ticket-pipeline phase routes versus completed Codex spawns  | Retire phase, iteration, stable child ID, and required-skill reconciliation. Current normalized native acceptance does not provide those bindings. The deprecated baseline receives no special instrumentation.                                                    |
| Goal-loop selected routes versus applied routes             | Retire private selected/effective contract reconciliation. Public native model/effort expectations remain independently observed, separate from the parent route. Archived selected/effective labels cannot become current route passes.                           |
| Guard-accepted adaptive owner without a ledger report       | Preserve passive ownership and native acceptance checks. Bundled-host enforced execution remains explicitly unsupported; no removed guard, strict contract validator, or runtime ledger is recreated.                                                              |
| First-class native goal runner                              | Preserve the accepted owner and no-parent-work boundaries through public native evidence. Private persistence and launch attestations retire; unknown encrypted role and contract contents remain unverified.                                                      |

## Evidence and limits

Current public coverage lives in:

- [owner evidence fixtures](../domain/owner-evidence-policy.test.ts) and
  [owner evidence validation](owner-evidence-validation.md);
- [benchmark record tests](../runner/parity/sevro-benchmark-caller.test.ts) and
  [benchmark caller validation](benchmark-caller-validation.md);
- [extension protocol tests](../runner/parity/sevro-extension.test.ts), including
  non-ready stops, correlated acceptance, separate parent activity, and named
  task-check metrics;
- [archival claims validation](historical-claims-validation.md); and
- [explicit passive benchmark validation](passive-benchmark-validation.md).

These are deliberate migrations. They do not establish live phase equivalence,
native confirmation of reported counts, complete child token accounting, or
equivalence to the retired goal-loop runtime. Original historical snapshots stay
unchanged and retain their earlier instrumentation and interpretation.

The legacy mixed implementation and unit tests remain until the exact package
pin permits caller cutover. This documentation adds no product code or test
harness. Publication, pinning, generic removal, installed CI, and the final
acceptance audit remain separate work.
