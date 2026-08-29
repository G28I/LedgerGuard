import type { ResultStatus, MatchMethod, ExceptionType } from '@prisma/client';
import type { NormalizedInvoice, NormalizedBankTx, NormalizedLedgerEntry } from '@/features/reconciliation';

export type BenchmarkScenarioType =
  | 'EXACT_MATCH'
  | 'VENDOR_VARIATION'
  | 'REF_VARIATION'
  | 'AMOUNT_MISMATCH'
  | 'DATE_MISMATCH'
  | 'MISSING_RECORD'
  | 'DUPLICATE'
  | 'AMBIGUOUS_MATCH'
  | 'ADVERSARIAL_LOOKALIKE'
  | 'ADVERSARIAL_DUPLICATE_MEMO'
  | 'ADVERSARIAL_GARBAGE_MEMO';

/**
 * Isolated Ground Truth Label for a single reconciliation case.
 * Used strictly for offline evaluation in features/benchmark/.
 * Note: expectedMatchMethod is diagnostic metadata only and NOT a correctness penalty criterion.
 */
export interface GroundTruthLabel {
  caseId: string;
  scenarioType: BenchmarkScenarioType;
  expectedStatus: ResultStatus; // MATCHED | MISMATCH | UNRESOLVED
  expectedMatchedInvoiceId: string;
  expectedMatchedBankTxId?: string | null;
  expectedMatchedLedgerEntryId?: string | null;
  expectedExceptionType?: ExceptionType | null;
  diagnosticIntendedMethod?: MatchMethod; // Diagnostic metadata only
  notes?: string;
}

/**
 * Synthetic Batch Dataset Output Contract.
 * Enforces strict separation between runtime source records and ground truth labels.
 */
export interface SyntheticBatchDataset {
  seed: number;
  totalCases: number;
  // Source records provided to the runtime reconciliation engine (0 groundTruthId)
  sourceRecords: {
    invoices: NormalizedInvoice[];
    bankTransactions: NormalizedBankTx[];
    ledgerEntries: NormalizedLedgerEntry[];
  };
  // Ground truth map stored strictly in features/benchmark/ for offline evaluation
  groundTruthMap: Map<string, GroundTruthLabel>;
}

/**
 * Objective Benchmark Evaluation Report Contract
 */
export interface BenchmarkScoreReport {
  totalCasesEvaluated: number;
  correctDecisions: number;
  incorrectDecisions: number;
  accuracyPercentage: number; // 0.00 to 100.00%
  matchMetrics: {
    precision: number;
    recall: number;
    f1Score: number;
  };
  exceptionMetrics: {
    precision: number;
    recall: number;
    f1Score: number;
  };
  scenarioBreakdown: Record<BenchmarkScenarioType, { total: number; correct: number }>;
}
