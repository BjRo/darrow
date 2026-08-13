export interface SuiteCellStatus {
  /** Whether this cell contributes to the suite's pass/fail gate. */
  gating: boolean;
  exitCode: number;
}

/** Comparative-only cells remain evidence even when their workload checks fail. */
export function hasGatingCellFailure(cells: SuiteCellStatus[]): boolean {
  return cells.some((cell) => cell.gating && cell.exitCode !== 0);
}
