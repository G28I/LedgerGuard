/**
 * Reconciliation Feature Domain
 * Pure domain logic and application orchestration service for financial reconciliation.
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

// Domain Models & Contracts
export type {
  NormalizedInvoice,
  NormalizedBankTx,
  NormalizedLedgerEntry,
  CandidatePair,
  ReconciliationDecision,
  ReconciliationPolicyConfig,
  RuleStrength,
  ExceptionDetailPackage,
  ExecuteRunParams,
  ReconciliationRunSummaryResponse,
} from './types';

export { DEFAULT_RECONCILIATION_POLICY } from './types';

// Text Normalization & Similarity
export {
  cleanRef,
  normalizeVendorName,
  extractReferenceToken,
  calculateVendorSimilarity,
  calculateDateDeltaDays,
} from './normalize';

// Candidate Generation
export { generateCandidatePairs } from './candidates';

// Reconciliation Pipeline Engine
export { runReconciliationEngine } from './engine';

// Application Orchestration Service
export { reconciliationService } from './service';

// Safety & AI Eligibility
export { isAiEligible } from './safety';

// Edge Cases Verification Runner
export { runFeature4EdgeCasesVerification } from './verify-feature4';
