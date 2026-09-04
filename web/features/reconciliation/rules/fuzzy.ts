import type { CandidatePair, ReconciliationDecision, ReconciliationPolicyConfig } from '../types';

/**
 * Level 2: Bounded Fuzzy Matching & Discrepancy Rules
 * Enforces independent evidence requirement before marking any fuzzy candidate as MATCHED.
 * Distinguishes financial MISMATCH from missing records.
 */
export function evaluateFuzzyRule(
  candidate: CandidatePair,
  policy: ReconciliationPolicyConfig
): ReconciliationDecision | null {
  const { invoice, bankTx, ledgerEntry, vendorSimilarity, hasExactRefMatch, amountDeltaCents, dateDeltaDays } = candidate;

  if (!bankTx) return null;

  const inDateWindow =
    dateDeltaDays >= policy.dateWindowDays.minDaysBefore &&
    dateDeltaDays <= policy.dateWindowDays.maxDaysAfter;

  const isCurrencyMatch = invoice.currency === bankTx.currency;
  const isCredibleRecord = isCurrencyMatch && (hasExactRefMatch || vendorSimilarity >= policy.minVendorSimilarityThreshold);

  if (!isCredibleRecord) {
    return null; // Not a credible candidate for fuzzy decision
  }

  // 1. Amount Discrepancy Check (Credible record found but amounts conflict)
  if (amountDeltaCents !== 0) {
    const isWithinFeeTolerance = Math.abs(amountDeltaCents) <= policy.maxAllowedFeeDeltaCents;
    
    return {
      invoiceId: invoice.id,
      bankTransactionId: bankTx.id,
      ledgerEntryId: ledgerEntry?.id ?? null,
      status: isWithinFeeTolerance && hasExactRefMatch ? 'UNRESOLVED' : 'MISMATCH',
      method: 'FUZZY',
      ruleStrength: 'DISCREPANCY',
      confidence: null,
      amountDeltaCents,
      reasonCode: 'AMOUNT_MISMATCH',
      explanation: `Credible record match found (${hasExactRefMatch ? 'Exact Ref' : 'Vendor Similarity ' + (vendorSimilarity * 100).toFixed(0) + '%'}), but settlement amount $${(bankTx.amountCents / 100).toFixed(2)} differs from invoice amount $${(invoice.amountCents / 100).toFixed(2)} by $${(amountDeltaCents / 100).toFixed(2)}.`,
      evidenceJson: {
        vendorSimilarity,
        hasExactRefMatch,
        invoiceAmountCents: invoice.amountCents,
        bankAmountCents: bankTx.amountCents,
        amountDeltaCents,
      },
      exceptions: [
        {
          type: 'AMOUNT_MISMATCH',
          priority: Math.abs(amountDeltaCents) > 1000 ? 'HIGH' : 'MEDIUM',
          reason: `Settlement amount $${(bankTx.amountCents / 100).toFixed(2)} conflicts with Invoice amount $${(invoice.amountCents / 100).toFixed(2)}.`,
          expectedValue: `$${(invoice.amountCents / 100).toFixed(2)} (${invoice.amountCents} cents)`,
          observedValue: `$${(bankTx.amountCents / 100).toFixed(2)} (${bankTx.amountCents} cents)`,
        },
      ],
    };
  }

  // 2. Date Discrepancy Check (Credible record found but dates conflict)
  if (!inDateWindow) {
    return {
      invoiceId: invoice.id,
      bankTransactionId: bankTx.id,
      ledgerEntryId: ledgerEntry?.id ?? null,
      status: 'UNRESOLVED',
      method: 'FUZZY',
      ruleStrength: 'DISCREPANCY',
      confidence: null,
      amountDeltaCents: 0,
      reasonCode: 'DATE_MISMATCH',
      explanation: `Credible record match found, but transaction date (${bankTx.transactionDate.toISOString().split('T')[0]}) is ${dateDeltaDays} days relative to invoice date (${invoice.issueDate.toISOString().split('T')[0]}), exceeding policy window [${policy.dateWindowDays.minDaysBefore}, ${policy.dateWindowDays.maxDaysAfter}] days.`,
      evidenceJson: {
        vendorSimilarity,
        hasExactRefMatch,
        dateDeltaDays,
        allowedWindow: policy.dateWindowDays,
      },
      exceptions: [
        {
          type: 'DATE_MISMATCH',
          priority: 'MEDIUM',
          reason: `Transaction date is ${dateDeltaDays} days out of bounds from invoice date.`,
          expectedValue: `Within [${policy.dateWindowDays.minDaysBefore}, ${policy.dateWindowDays.maxDaysAfter}] days of ${invoice.issueDate.toISOString().split('T')[0]}`,
          observedValue: `${bankTx.transactionDate.toISOString().split('T')[0]} (${dateDeltaDays} days delta)`,
        },
      ],
    };
  }

  // 3. User Adjustment #1: Bounded Fuzzy Match - Require independent evidence before marking MATCHED
  if (vendorSimilarity >= policy.minVendorSimilarityThreshold && amountDeltaCents === 0 && inDateWindow) {
    // Lacks independent reference evidence -> Return UNRESOLVED to prevent false-positive matches on coincidental vendor+amount
    if (!hasExactRefMatch) {
      return {
        invoiceId: invoice.id,
        bankTransactionId: bankTx.id,
        ledgerEntryId: ledgerEntry?.id ?? null,
        status: 'UNRESOLVED',
        method: 'FUZZY',
        ruleStrength: 'FUZZY_LOW',
        confidence: null,
        amountDeltaCents: 0,
        reasonCode: 'INSUFFICIENT_EVIDENCE',
        explanation: `Vendor similarity ${(vendorSimilarity * 100).toFixed(0)}% and exact amount match, but lacks independent reference token evidence for auto-resolution.`,
        evidenceJson: {
          vendorSimilarity,
          hasExactRefMatch: false,
          amountDeltaCents: 0,
        },
        exceptions: [
          {
            type: 'INSUFFICIENT_EVIDENCE',
            priority: 'LOW',
            reason: `Fuzzy vendor match requires independent reference token or cross-reference evidence to auto-resolve.`,
            expectedValue: 'Exact reference token or structural proof',
            observedValue: `Vendor similarity ${(vendorSimilarity * 100).toFixed(0)}% without reference link`,
          },
        ],
      };
    }

    // Has independent reference evidence -> Return MATCHED with FUZZY_HIGH
    return {
      invoiceId: invoice.id,
      bankTransactionId: bankTx.id,
      ledgerEntryId: ledgerEntry?.id ?? null,
      status: 'MATCHED',
      method: 'FUZZY',
      ruleStrength: 'FUZZY_HIGH',
      confidence: null,
      amountDeltaCents: 0,
      reasonCode: 'FUZZY_VENDOR_WITH_EVIDENCE_MATCH',
      explanation: `Fuzzy vendor match (${(vendorSimilarity * 100).toFixed(0)}%) with independent reference token evidence and exact settlement amount.`,
      evidenceJson: {
        vendorSimilarity,
        hasExactRefMatch: true,
        amountDeltaCents: 0,
      },
      exceptions: [],
    };
  }

  return null;
}
