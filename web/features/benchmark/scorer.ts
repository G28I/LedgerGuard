import type { ReconciliationDecision } from '../reconciliation/types';
import type { GroundTruthLabel } from './types';

export interface BenchmarkScoreResult {
  totalRecords: number;
  matchedCount: number;
  unresolvedCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number; // Ratio e.g. 0.925
  precision: number; // Ratio e.g. 1.0
  recall: number; // Ratio e.g. 1.0
  f1Score: number; // Ratio e.g. 1.0
  resolutionRate: number; // Ratio e.g. 0.60
  aiEvaluatedCount: number;
  aiPromotedCount: number;
  aiFalsePositiveCount: number;
}

export interface ScoreBenchmarkRunOptions {
  aiEvaluatedInvoiceIds?: Set<string> | string[];
}

/**
 * Offline Benchmark Scorer
 * Evaluates reconciliation decisions against ground truth map after run completes.
 * Strict Boundary: This function is invoked AFTER reconciliation finishes.
 * The runtime reconciliation engine/service does NOT consume this function or ground truth.
 */
export function scoreBenchmarkRun(
  decisions: ReconciliationDecision[],
  groundTruthMap: Map<string, GroundTruthLabel>,
  options?: ScoreBenchmarkRunOptions
): BenchmarkScoreResult {
  const totalRecords = decisions.length;
  let matchedCount = 0;
  let unresolvedCount = 0;

  let truePositives = 0; // GT = MATCHED, Prediction = MATCHED
  let falsePositives = 0; // Prediction = MATCHED, but GT = UNRESOLVED / MISMATCH
  let falseNegatives = 0; // GT = MATCHED, but Prediction = UNRESOLVED / MISMATCH
  let trueNegatives = 0; // GT = UNRESOLVED / MISMATCH, Prediction = UNRESOLVED / MISMATCH

  let correctCount = 0;
  let incorrectCount = 0;

  let aiEvaluatedCount = 0;
  if (options?.aiEvaluatedInvoiceIds) {
    aiEvaluatedCount =
      options.aiEvaluatedInvoiceIds instanceof Set
        ? options.aiEvaluatedInvoiceIds.size
        : options.aiEvaluatedInvoiceIds.length;
  }

  let aiPromotedCount = 0;
  let aiFalsePositiveCount = 0;

  decisions.forEach((d) => {
    if (d.status === 'MATCHED') matchedCount++;
    else unresolvedCount++;

    if (d.method === 'AI') {
      if (!options?.aiEvaluatedInvoiceIds) {
        aiEvaluatedCount++;
      }
      if (d.status === 'MATCHED') {
        aiPromotedCount++;
      }
    }

    if (!d.invoiceId) return;
    const gt = groundTruthMap.get(d.invoiceId);
    if (!gt) return;

    const expectedStatus = gt.expectedStatus;
    const expectedBankTxId = gt.expectedMatchedBankTxId;
    const expectedExceptionType = gt.expectedExceptionType;

    const isStatusMatch =
      d.status === expectedStatus ||
      (d.status === 'UNRESOLVED' && expectedStatus === 'MISMATCH');

    const isBankTxMatch =
      expectedStatus !== 'MATCHED' ||
      !expectedBankTxId ||
      d.bankTransactionId === expectedBankTxId;

    const isExcMatch =
      expectedExceptionType === null || expectedExceptionType === undefined
        ? d.exceptions.length === 0
        : d.exceptions.some((e) => e.type === expectedExceptionType);

    const isFullyCorrect = isStatusMatch && isBankTxMatch && isExcMatch;

    if (isFullyCorrect) {
      correctCount++;
      if (expectedStatus === 'MATCHED') {
        truePositives++;
      } else {
        trueNegatives++;
      }
    } else {
      incorrectCount++;
      if (expectedStatus === 'MATCHED') {
        falseNegatives++;
      } else {
        falsePositives++;
      }

      if (d.method === 'AI' && d.status === 'MATCHED') {
        aiFalsePositiveCount++;
      }
    }
  });

  const accuracy = totalRecords > 0 ? Number((correctCount / totalRecords).toFixed(4)) : 0;
  const resolutionRate = totalRecords > 0 ? Number((matchedCount / totalRecords).toFixed(4)) : 0;

  const precisionDenom = truePositives + falsePositives;
  const precision = precisionDenom > 0 ? Number((truePositives / precisionDenom).toFixed(4)) : 1.0;

  const recallDenom = truePositives + falseNegatives;
  const recall = recallDenom > 0 ? Number((truePositives / recallDenom).toFixed(4)) : 1.0;

  const f1Denom = precision + recall;
  const f1Score = f1Denom > 0 ? Number(((2 * precision * recall) / f1Denom).toFixed(4)) : 1.0;

  return {
    totalRecords,
    matchedCount,
    unresolvedCount,
    correctCount,
    incorrectCount,
    accuracy,
    precision,
    recall,
    f1Score,
    resolutionRate,
    aiEvaluatedCount,
    aiPromotedCount,
    aiFalsePositiveCount,
  };
}
