/**
 * Formats an internal metric ratio (e.g. 0.925 -> 92.5%, 1.0 -> 100.0%)
 * or legacy percentage value into a clean presentation string.
 * Returns 'N/A' if null, undefined, or NaN. Never fabricates fallback values.
 */
export function formatMetricAsPercent(
  value: number | null | undefined,
  precision = 1
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }
  // If value is already in percentage space (> 1.0, e.g. 92.5)
  if (value > 1) {
    return `${value.toFixed(precision)}%`;
  }
  // Otherwise it's a normalized ratio (0.0 to 1.0)
  return `${(value * 100).toFixed(precision)}%`;
}
