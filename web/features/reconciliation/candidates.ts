import type { 
  NormalizedInvoice, 
  NormalizedBankTx, 
  NormalizedLedgerEntry, 
  CandidatePair,
  ReconciliationPolicyConfig
} from './types';
import { 
  cleanRef, 
  normalizeVendorName, 
  extractReferenceToken, 
  calculateVendorSimilarity, 
  calculateDateDeltaDays 
} from './normalize';

/**
 * Multi-Index Candidate Pair Generator
 * Generates candidate pairs for rule evaluation without making amount a de facto identity key.
 */
export function generateCandidatePairs(
  invoices: NormalizedInvoice[],
  bankTxs: NormalizedBankTx[],
  ledgerEntries: NormalizedLedgerEntry[],
  policy: ReconciliationPolicyConfig
): Map<string, CandidatePair[]> {
  const candidatesMap = new Map<string, CandidatePair[]>();

  // Index Bank Transactions by Reference, Extracted Ref, and Vendor Tokens
  const bankByRef = new Map<string, NormalizedBankTx[]>();
  const bankByVendorToken = new Map<string, NormalizedBankTx[]>();

  for (const tx of bankTxs) {
    // Clean ref index
    const refKey = cleanRef(tx.transactionRef);
    if (refKey) {
      const list = bankByRef.get(refKey) ?? [];
      list.push(tx);
      bankByRef.set(refKey, list);
    }

    // Extracted memo ref index
    const extractedRefKey = extractReferenceToken(tx.description);
    if (extractedRefKey) {
      const list = bankByRef.get(extractedRefKey) ?? [];
      list.push(tx);
      bankByRef.set(extractedRefKey, list);
    }

    // Vendor token index
    const normVendor = normalizeVendorName(tx.description);
    const tokens = normVendor.split(' ').filter((t) => t.length > 2);
    for (const token of tokens) {
      const list = bankByVendorToken.get(token) ?? [];
      list.push(tx);
      bankByVendorToken.set(token, list);
    }
  }

  // Index Ledger Entries by Entry Ref
  const ledgerByRef = new Map<string, NormalizedLedgerEntry[]>();
  for (const entry of ledgerEntries) {
    const refKey = cleanRef(entry.entryRef);
    if (refKey) {
      const list = ledgerByRef.get(refKey) ?? [];
      list.push(entry);
      ledgerByRef.set(refKey, list);
    }
  }

  // Generate Candidates for Each Invoice
  for (const invoice of invoices) {
    const invRefKey = cleanRef(invoice.invoiceNumber);
    const invVendorNorm = normalizeVendorName(invoice.vendorName);

    const candidateBankTxs = new Map<string, NormalizedBankTx>();

    // 1. Fetch reference-matched candidates
    if (invRefKey && bankByRef.has(invRefKey)) {
      bankByRef.get(invRefKey)?.forEach((tx) => candidateBankTxs.set(tx.id, tx));
    }

    // 2. Fetch vendor token-matched candidates
    const invTokens = invVendorNorm.split(' ').filter((t) => t.length > 2);
    for (const token of invTokens) {
      if (bankByVendorToken.has(token)) {
        bankByVendorToken.get(token)?.forEach((tx) => candidateBankTxs.set(tx.id, tx));
      }
    }

    const pairs: CandidatePair[] = [];

    candidateBankTxs.forEach((bankTx) => {
      const txRefKey = cleanRef(bankTx.transactionRef);
      const extractedMemoRef = extractReferenceToken(bankTx.description);
      const hasExactRefMatch = (invRefKey !== '' && invRefKey === txRefKey) || (invRefKey !== '' && invRefKey === extractedMemoRef);

      const vendorSim = calculateVendorSimilarity(invoice.vendorName, bankTx.description);
      const dateDeltaDays = calculateDateDeltaDays(bankTx.transactionDate, invoice.issueDate);
      const amountDeltaCents = bankTx.amountCents - invoice.amountCents;

      // Find matching ledger entry if available
      const matchingLedger = invRefKey ? ledgerByRef.get(invRefKey)?.[0] ?? null : null;

      // Calculate candidate match score (Reference, Vendor, Date proximity)
      let score = 0;
      if (hasExactRefMatch) {
        score += 0.50;
      }
      score += vendorSim * 0.40;

      // Date window scoring
      if (dateDeltaDays >= policy.dateWindowDays.minDaysBefore && dateDeltaDays <= policy.dateWindowDays.maxDaysAfter) {
        score += 0.10;
      }

      pairs.push({
        invoice,
        bankTx,
        ledgerEntry: matchingLedger,
        matchScore: Math.min(1.0, score),
        amountDeltaCents,
        dateDeltaDays,
        vendorSimilarity: vendorSim,
        hasExactRefMatch,
      });
    });

    // Sort candidates by matchScore descending
    pairs.sort((a, b) => b.matchScore - a.matchScore);
    candidatesMap.set(invoice.id, pairs);
  }

  return candidatesMap;
}
