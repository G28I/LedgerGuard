import type { ResultStatus, MatchMethod, ExceptionType, ExceptionPriority } from '@prisma/client';

/**
 * Reconciliation Policy Configuration
 * Controllable policy constants for date windows, fee tolerances, and similarity thresholds.
 */
export interface ReconciliationPolicyConfig {
  dateWindowDays: {
    minDaysBefore: number; // e.g. -5 days before invoice issue date
    maxDaysAfter: number;  // e.g. +30 days after invoice issue date
  };
  maxAllowedFeeDeltaCents: number; // e.g. 500 cents ($5.00)
  minVendorSimilarityThreshold: number; // e.g. 0.85
  ambiguityDeltaThreshold: number; // e.g. 0.05 score difference for tie
}

export const DEFAULT_RECONCILIATION_POLICY: ReconciliationPolicyConfig = {
  dateWindowDays: {
    minDaysBefore: -5,
    maxDaysAfter: 30,
  },
  maxAllowedFeeDeltaCents: 500,
  minVendorSimilarityThreshold: 0.85,
  ambiguityDeltaThreshold: 0.05,
};

/**
 * Rule Strength Classification
 * Replaces fake calibrated float probabilities for deterministic rules.
 */
export type RuleStrength = 'EXACT' | 'FUZZY_HIGH' | 'FUZZY_LOW' | 'DISCREPANCY';

/**
 * Normalized Source Domain Records
 */
export interface NormalizedInvoice {
  id: string;
  invoiceNumber: string;       // Raw invoice ref
  cleanInvoiceNumber: string;  // Uppercase alphanumeric
  vendorName: string;          // Raw vendor name
  normalizedVendor: string;    // Lowercase, stripped corporate suffixes & punctuation
  amountCents: number;         // Integer cents
  currency: string;            // ISO currency string (e.g. "USD")
  issueDate: Date;             // ISO Date
  dueDate?: Date | null;
  rawRecord?: unknown;
}

export interface NormalizedBankTx {
  id: string;
  transactionRef: string;       // Raw transaction ref
  cleanTransactionRef: string;  // Uppercase alphanumeric
  description: string;          // Raw memo description
  normalizedDescription: string;// Lowercase, stripped punctuation
  extractedRef?: string | null; // Extracted invoice/PO ref token if present
  amountCents: number;          // Integer cents
  currency: string;             // ISO currency string
  transactionDate: Date;        // ISO Date
  rawRecord?: unknown;
}

export interface NormalizedLedgerEntry {
  id: string;
  entryRef: string;
  cleanEntryRef: string;
  accountCode: string;
  description: string;
  normalizedDescription: string;
  amountCents: number;
  currency: string;
  postingDate: Date;
  rawRecord?: unknown;
}

/**
 * Candidate Pair evaluated during candidate generation
 */
export interface CandidatePair {
  invoice: NormalizedInvoice;
  bankTx?: NormalizedBankTx | null;
  ledgerEntry?: NormalizedLedgerEntry | null;
  matchScore: number;           // Calculated similarity score (0.0 to 1.0)
  amountDeltaCents: number;     // bankTx.amountCents - invoice.amountCents
  dateDeltaDays: number;        // Days difference between transactionDate and issueDate
  vendorSimilarity: number;     // 0.0 to 1.0 vendor string similarity
  hasExactRefMatch: boolean;    // True if clean ref matches or extracted ref matches cleanInvoiceNumber
}

/**
 * Audit Exception Detail Package
 */
export interface ExceptionDetailPackage {
  type: ExceptionType;
  priority: ExceptionPriority;
  reason: string;
  expectedValue?: string;
  observedValue?: string;
}

/**
 * Pure Reconciliation Decision Object
 * Side-effect-free domain output contract.
 */
export interface ReconciliationDecision {
  invoiceId?: string | null;
  bankTransactionId?: string | null;
  ledgerEntryId?: string | null;
  status: ResultStatus;         // MATCHED | MISMATCH | UNRESOLVED
  method: MatchMethod;          // DETERMINISTIC | FUZZY | AI
  ruleStrength: RuleStrength;   // EXACT | FUZZY_HIGH | FUZZY_LOW | DISCREPANCY
  confidence: number | null;    // null for deterministic rules to avoid fake probability
  amountDeltaCents: number;
  reasonCode: string;
  explanation: string;
  evidenceJson: Record<string, unknown>;
  exceptions: ExceptionDetailPackage[];
}

/**
 * Parameters for executing a Reconciliation Run
 */
export interface ExecuteRunParams {
  seed?: number;
  batchName?: string;
  enableAI?: boolean;
  policyConfig?: Partial<ReconciliationPolicyConfig>;
}

/**
 * Stable Typed Response Contract for Reconciliation Run Execution (UI & API)
 */
export interface ReconciliationRunSummaryResponse {
  runId: string;
  runNumber: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalRecords: number;
  matchedCount: number;
  unresolvedCount: number;
  exceptionCount: number;
  aiCallCount: number;
  resolutionRate: number; // 0.0 to 1.0
  accuracyPercentage?: number | null; // Offline benchmark ground truth score if applicable
  durationMs: number;
  throughputRecordsPerSec: number;
  startedAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  resultsSummary: Array<{
    id: string;
    invoiceRef?: string;
    bankRef?: string;
    status: ResultStatus;
    method: MatchMethod;
    reasonCode: string;
    amountDeltaCents: number;
  }>;
  exceptionsSummary: Array<{
    id: string;
    type: ExceptionType;
    priority: ExceptionPriority;
    reason: string;
  }>;
}

