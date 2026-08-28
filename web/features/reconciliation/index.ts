/**
 * Reconciliation Feature Domain
 * Pure domain logic for multi-source financial reconciliation.
 */
export const RECONCILIATION_FEATURE_VERSION = '1.0.0';

/**
 * Financial Arithmetic Helper: Converts a dollar amount (e.g. 100.50) to integer cents (10050).
 * Prevents IEEE 754 floating-point inaccuracies during reconciliation matching.
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Converts integer cents (10050) back to a dollar string representation ("100.50").
 */
export function toDollarsString(cents: number): string {
  return (cents / 100).toFixed(2);
}
