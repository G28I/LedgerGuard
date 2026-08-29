import type { CandidatePair, ReconciliationDecision, ReconciliationPolicyConfig } from '../types';

/**
 * Level 1: Exact Deterministic Matching Rules
 * Evaluates candidates for exact reference, exact amount, currency, and valid date window.
 * Returns null confidence to avoid fake calibrated probability representations.
 */
export function evaluateExactDeterministicRule(
  candidate: CandidatePair,
  policy: ReconciliationPolicyConfig
): ReconciliationDecision | null {
  const { invoice, bankTx, ledgerEntry, hasExactRefMatch, amountDeltaCents, dateDeltaDays } = candidate;

  if (!bankTx) return null;

  // Currency equality check
  if (invoice.currency !== bankTx.currency) {
    return null; // Cross-currency matches are handled separately
  }

  const inDateWindow =
    dateDeltaDays >= policy.dateWindowDays.minDaysBefore &&
    dateDeltaDays <= policy.dateWindowDays.maxDaysAfter;

  // Rule 1.1: Exact Reference Match + Exact Amount Match + Valid Date Window
  if (hasExactRefMatch && amountDeltaCents === 0 && inDateWindow) {
    return {
      invoiceId: invoice.id,
      bankTransactionId: bankTx.id,
      ledgerEntryId: ledgerEntry?.id ?? null,
      status: 'MATCHED',
      method: 'DETERMINISTIC',
      ruleStrength: 'EXACT',
      confidence: null, // Null to avoid fake probability
      amountDeltaCents: 0,
      reasonCode: 'EXACT_REF_AND_AMOUNT_MATCH',
      explanation: `Exact reference match '${invoice.invoiceNumber}' and exact amount settlement $${(invoice.amountCents / 100).toFixed(2)} (${invoice.currency}).`,
      evidenceJson: {
        invoiceNumber: invoice.invoiceNumber,
        transactionRef: bankTx.transactionRef,
        matchedAmountCents: invoice.amountCents,
        dateDeltaDays,
        currency: invoice.currency,
      },
      exceptions: [],
    };
  }

  return null;
}
