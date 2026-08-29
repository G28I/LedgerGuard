import type { 
  CandidatePair, 
  ReconciliationDecision, 
  ReconciliationPolicyConfig,
  NormalizedInvoice 
} from './types';

/**
 * Safety & Disambiguation Rules
 * Enforces strict distinction between DUPLICATE transactions, AMBIGUOUS_MATCH candidate ties,
 * and MISSING_RECORD cases.
 */

export function evaluateMissingRecord(invoice: NormalizedInvoice): ReconciliationDecision {
  return {
    invoiceId: invoice.id,
    bankTransactionId: null,
    ledgerEntryId: null,
    status: 'UNRESOLVED',
    method: 'DETERMINISTIC',
    ruleStrength: 'DISCREPANCY',
    confidence: null,
    amountDeltaCents: -invoice.amountCents,
    reasonCode: 'MISSING_RECORD',
    explanation: `No corresponding bank transaction or ledger record found for Invoice '${invoice.invoiceNumber}' (${invoice.vendorName}, $${(invoice.amountCents / 100).toFixed(2)}).`,
    evidenceJson: {
      invoiceNumber: invoice.invoiceNumber,
      vendorName: invoice.vendorName,
      amountCents: invoice.amountCents,
    },
    exceptions: [
      {
        type: 'MISSING_RECORD',
        priority: 'HIGH',
        reason: `No matching bank or ledger settlement record found for Invoice ${invoice.invoiceNumber}.`,
        expectedValue: `Bank transaction for $${(invoice.amountCents / 100).toFixed(2)}`,
        observedValue: 'None (0 candidates found)',
      },
    ],
  };
}

export function evaluateCandidateSafety(
  invoice: NormalizedInvoice,
  candidates: CandidatePair[],
  policy: ReconciliationPolicyConfig
): { decision: ReconciliationDecision; isDuplicate: boolean; isAmbiguous: boolean } | null {
  if (candidates.length < 2) return null;

  const top1 = candidates[0];
  const top2 = candidates[1];

  if (!top1.bankTx || !top2.bankTx) return null;

  // 1. User Adjustment #2: Check for DUPLICATE (effectively identical transactions representing the same payment)
  const isIdenticalAmount = top1.bankTx.amountCents === top2.bankTx.amountCents;
  const isIdenticalDate = top1.bankTx.transactionDate.getTime() === top2.bankTx.transactionDate.getTime();
  const isIdenticalRef = top1.bankTx.cleanTransactionRef === top2.bankTx.cleanTransactionRef;
  const isIdenticalDesc = top1.bankTx.normalizedDescription === top2.bankTx.normalizedDescription;

  const isDuplicate = isIdenticalAmount && (isIdenticalRef || (isIdenticalDate && isIdenticalDesc));

  if (isDuplicate) {
    return {
      isDuplicate: true,
      isAmbiguous: false,
      decision: {
        invoiceId: invoice.id,
        bankTransactionId: top1.bankTx.id,
        ledgerEntryId: top1.ledgerEntry?.id ?? null,
        status: 'UNRESOLVED',
        method: 'FUZZY',
        ruleStrength: 'DISCREPANCY',
        confidence: null,
        amountDeltaCents: 0,
        reasonCode: 'DUPLICATE_TRANSACTION_DETECTED',
        explanation: `Multiple effectively identical bank transactions (${top1.bankTx.transactionRef}, ${top2.bankTx.transactionRef}) detected for Invoice '${invoice.invoiceNumber}'.`,
        evidenceJson: {
          candidate1Ref: top1.bankTx.transactionRef,
          candidate2Ref: top2.bankTx.transactionRef,
          amountCents: top1.bankTx.amountCents,
        },
        exceptions: [
          {
            type: 'DUPLICATE',
            priority: 'HIGH',
            reason: `Multiple duplicate settlement transactions (${top1.bankTx.transactionRef}, ${top2.bankTx.transactionRef}) found for single invoice ${invoice.invoiceNumber}.`,
            expectedValue: `1 unique bank transaction`,
            observedValue: `2 identical transactions for $${(top1.bankTx.amountCents / 100).toFixed(2)}`,
          },
        ],
      },
    };
  }

  // 2. User Adjustment #2: Check for AMBIGUOUS_MATCH (multiple plausible but non-identical candidates)
  const scoreDelta = Math.abs(top1.matchScore - top2.matchScore);
  const isAmbiguous = scoreDelta <= policy.ambiguityDeltaThreshold && (top1.matchScore >= 0.35 || top1.vendorSimilarity >= 0.60);

  if (isAmbiguous) {
    return {
      isDuplicate: false,
      isAmbiguous: true,
      decision: {
        invoiceId: invoice.id,
        bankTransactionId: top1.bankTx.id,
        ledgerEntryId: top1.ledgerEntry?.id ?? null,
        status: 'UNRESOLVED',
        method: 'FUZZY',
        ruleStrength: 'FUZZY_LOW',
        confidence: null,
        amountDeltaCents: top1.amountDeltaCents,
        reasonCode: 'AMBIGUOUS_MATCH_TIE',
        explanation: `Multiple plausible non-identical candidate transactions (${top1.bankTx.transactionRef} vs ${top2.bankTx.transactionRef}) tie with score delta ${scoreDelta.toFixed(3)} (below ${policy.ambiguityDeltaThreshold} threshold).`,
        evidenceJson: {
          topCandidate1: { ref: top1.bankTx.transactionRef, score: top1.matchScore },
          topCandidate2: { ref: top2.bankTx.transactionRef, score: top2.matchScore },
          scoreDelta,
        },
        exceptions: [
          {
            type: 'AMBIGUOUS_MATCH',
            priority: 'MEDIUM',
            reason: `Multiple plausible candidate transactions match invoice ${invoice.invoiceNumber} with near-identical similarity scores (${top1.matchScore.toFixed(2)} vs ${top2.matchScore.toFixed(2)}).`,
            expectedValue: `Distinct top candidate (score delta > ${policy.ambiguityDeltaThreshold})`,
            observedValue: `Top candidate score delta is ${scoreDelta.toFixed(3)}`,
          },
        ],
      },
    };
  }

  return null;
}
