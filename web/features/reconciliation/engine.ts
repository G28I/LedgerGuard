import type { 
  NormalizedInvoice, 
  NormalizedBankTx, 
  NormalizedLedgerEntry, 
  ReconciliationDecision, 
  ReconciliationPolicyConfig 
} from './types';
import { DEFAULT_RECONCILIATION_POLICY } from './types';
import { generateCandidatePairs } from './candidates';
import { evaluateExactDeterministicRule } from './rules/exact';
import { evaluateFuzzyRule } from './rules/fuzzy';
import { evaluateCandidateSafety, evaluateMissingRecord } from './safety';

/**
 * Pure Reconciliation Domain Engine
 * Takes normalized source records, evaluates deterministic & bounded fuzzy rules,
 * enforces safety/ambiguity checks, and returns pure decision objects.
 * 
 * Side-effect-free: 0 database calls, 0 network calls, 0 UI dependencies.
 */
export function runReconciliationEngine(
  invoices: NormalizedInvoice[],
  bankTransactions: NormalizedBankTx[],
  ledgerEntries: NormalizedLedgerEntry[],
  customPolicy?: Partial<ReconciliationPolicyConfig>
): ReconciliationDecision[] {
  const policy: ReconciliationPolicyConfig = {
    ...DEFAULT_RECONCILIATION_POLICY,
    ...customPolicy,
    dateWindowDays: {
      ...DEFAULT_RECONCILIATION_POLICY.dateWindowDays,
      ...customPolicy?.dateWindowDays,
    },
  };

  // 1. Generate Candidates via Multi-Index Candidate Generator
  const candidatesMap = generateCandidatePairs(invoices, bankTransactions, ledgerEntries, policy);

  const decisions: ReconciliationDecision[] = [];

  for (const invoice of invoices) {
    const candidates = candidatesMap.get(invoice.id) ?? [];

    // Case A: Missing Record (0 candidates found)
    if (candidates.length === 0) {
      decisions.push(evaluateMissingRecord(invoice));
      continue;
    }

    // Case B: Safety Checks (Duplicates & Ambiguous Candidate Ties)
    const safetyResult = evaluateCandidateSafety(invoice, candidates, policy);
    if (safetyResult) {
      decisions.push(safetyResult.decision);
      continue;
    }

    // Case C: Evaluate Top Candidate Pair
    const topCandidate = candidates[0];

    // Level 1: Exact Deterministic Rule Evaluation
    const exactDecision = evaluateExactDeterministicRule(topCandidate, policy);
    if (exactDecision) {
      decisions.push(exactDecision);
      continue;
    }

    // Level 2: Bounded Fuzzy Rule Evaluation
    const fuzzyDecision = evaluateFuzzyRule(topCandidate, policy);
    if (fuzzyDecision) {
      decisions.push(fuzzyDecision);
      continue;
    }

    // Default Fallback: Insufficient Evidence / Unresolved
    decisions.push({
      invoiceId: invoice.id,
      bankTransactionId: topCandidate.bankTx?.id ?? null,
      ledgerEntryId: topCandidate.ledgerEntry?.id ?? null,
      status: 'UNRESOLVED',
      method: 'DETERMINISTIC',
      ruleStrength: 'FUZZY_LOW',
      confidence: null,
      amountDeltaCents: topCandidate.amountDeltaCents,
      reasonCode: 'INSUFFICIENT_EVIDENCE',
      explanation: `Candidate records exist for Invoice '${invoice.invoiceNumber}', but rule evidence is insufficient for auto-resolution.`,
      evidenceJson: {
        candidateCount: candidates.length,
        topCandidateScore: topCandidate.matchScore,
        vendorSimilarity: topCandidate.vendorSimilarity,
        hasExactRefMatch: topCandidate.hasExactRefMatch,
      },
      exceptions: [
        {
          type: 'INSUFFICIENT_EVIDENCE',
          priority: 'LOW',
          reason: `Insufficient evidence to resolve Invoice ${invoice.invoiceNumber} deterministically.`,
          expectedValue: 'Rule match with confidence threshold',
          observedValue: `Match score ${topCandidate.matchScore.toFixed(2)} without reference proof`,
        },
      ],
    });
  }

  return decisions;
}
