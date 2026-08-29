import type { 
  NormalizedInvoice, 
  CandidatePair, 
  ReconciliationDecision, 
  ReconciliationPolicyConfig 
} from '@/features/reconciliation';
import type { AIResolverInput, AICandidateEvidence, AIResolverResult } from './types';
import { aiResolverOutputSchema } from './types';
import { callOpenRouterAIResolver, PRIMARY_OPENROUTER_MODEL } from './openrouter';

/**
 * AI Ambiguity Resolver Service
 * Evaluates UNRESOLVED decisions using OpenRouter LLM, enforces Zod validation,
 * and applies strict application-side financial safety checks before promoting any candidate to MATCHED.
 */
export async function resolveAmbiguityWithAI(
  invoice: NormalizedInvoice,
  candidates: CandidatePair[],
  deterministicDecision: ReconciliationDecision,
  policy: ReconciliationPolicyConfig
): Promise<AIResolverResult> {
  const startTime = Date.now();

  // 1. Candidate Bounding: Take top 3 candidate pairs only
  const topCandidates = candidates.slice(0, 3);

  const candidatePayload: AICandidateEvidence[] = topCandidates
    .filter((c) => c.bankTx !== null && c.bankTx !== undefined)
    .map((c) => {
      const tx = c.bankTx!;
      return {
        bankTxId: tx.id,
        transactionRef: tx.transactionRef,
        description: tx.description,
        amountCents: tx.amountCents,
        currency: tx.currency,
        transactionDate: tx.transactionDate.toISOString().split('T')[0],
        vendorSimilarity: Number(c.vendorSimilarity.toFixed(3)),
        dateDeltaDays: c.dateDeltaDays,
        amountDeltaCents: c.amountDeltaCents,
      };
    });

  const inputPayload: AIResolverInput = {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      vendorName: invoice.vendorName,
      amountCents: invoice.amountCents,
      currency: invoice.currency,
      issueDate: invoice.issueDate.toISOString().split('T')[0],
    },
    candidates: candidatePayload,
    reconciliationContext: {
      reasonCode: deterministicDecision.reasonCode,
      explanation: deterministicDecision.explanation,
    },
  };

  // 2. Call OpenRouter API
  let openRouterOutput;
  try {
    openRouterOutput = await callOpenRouterAIResolver(inputPayload, PRIMARY_OPENROUTER_MODEL);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[AIResolver] OpenRouter provider unavailable for Invoice ${invoice.invoiceNumber}: ${errMsg}`);
    return {
      status: 'UNRESOLVED',
      selectedBankTxId: null,
      confidenceScore: null,
      reasoning: `AI provider unavailable: ${errMsg}`,
      keyEvidence: [],
      actualModelUsed: PRIMARY_OPENROUTER_MODEL,
      promptDurationMs: Date.now() - startTime,
      exceptionType: 'AI_UNAVAILABLE',
      exceptionReason: `OpenRouter provider call failed: ${errMsg}`,
    };
  }

  // 3. Zod Response Validation
  let parsedOutput;
  try {
    const rawJsonObject = JSON.parse(openRouterOutput.rawJsonText);
    parsedOutput = aiResolverOutputSchema.parse(rawJsonObject);
  } catch (parseErr: unknown) {
    const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    console.warn(`[AIResolver] Invalid AI response schema for Invoice ${invoice.invoiceNumber}: ${parseMsg}`);
    return {
      status: 'UNRESOLVED',
      selectedBankTxId: null,
      confidenceScore: null,
      reasoning: `AI model output failed Zod schema validation: ${parseMsg}`,
      keyEvidence: [],
      actualModelUsed: openRouterOutput.actualModelUsed,
      promptDurationMs: openRouterOutput.promptDurationMs,
      exceptionType: 'AI_INVALID_RESPONSE',
      exceptionReason: `AI model output did not match required schema: ${parseMsg}`,
    };
  }

  // 4. Application-Side Safety & Promotion Gate
  // Invariant: The application (NOT the model) enforces financial safety before promoting any candidate to MATCHED!
  if (parsedOutput.decision !== 'MATCH' || !parsedOutput.selectedBankTxId) {
    return {
      status: 'UNRESOLVED',
      selectedBankTxId: null,
      confidenceScore: parsedOutput.confidenceScore,
      reasoning: parsedOutput.reasoning,
      keyEvidence: parsedOutput.keyEvidence,
      actualModelUsed: openRouterOutput.actualModelUsed,
      promptDurationMs: openRouterOutput.promptDurationMs,
    };
  }

  // Safety Check A: Candidate Membership (selectedBankTxId MUST exist in top candidates)
  const matchedPair = topCandidates.find((c) => c.bankTx?.id === parsedOutput.selectedBankTxId);
  if (!matchedPair || !matchedPair.bankTx) {
    console.warn(`[AIResolver] Safety Gate Rejected: AI selected candidate ${parsedOutput.selectedBankTxId} not present in candidate set.`);
    return {
      status: 'UNRESOLVED',
      selectedBankTxId: null,
      confidenceScore: parsedOutput.confidenceScore,
      reasoning: `AI selected candidate ID ${parsedOutput.selectedBankTxId} is not in the valid candidate set.`,
      keyEvidence: parsedOutput.keyEvidence,
      actualModelUsed: openRouterOutput.actualModelUsed,
      promptDurationMs: openRouterOutput.promptDurationMs,
    };
  }

  // Safety Check B: Minimum AI Confidence Threshold (>= 0.80)
  if (parsedOutput.confidenceScore < 0.80) {
    return {
      status: 'UNRESOLVED',
      selectedBankTxId: null,
      confidenceScore: parsedOutput.confidenceScore,
      reasoning: `AI confidence score ${parsedOutput.confidenceScore.toFixed(2)} is below minimum threshold 0.80.`,
      keyEvidence: parsedOutput.keyEvidence,
      actualModelUsed: openRouterOutput.actualModelUsed,
      promptDurationMs: openRouterOutput.promptDurationMs,
    };
  }

  // Safety Check C: Amount Delta Policy ($5.00 fee tolerance limit)
  const amountDelta = Math.abs(matchedPair.amountDeltaCents);
  if (amountDelta > policy.maxAllowedFeeDeltaCents) {
    return {
      status: 'UNRESOLVED',
      selectedBankTxId: null,
      confidenceScore: parsedOutput.confidenceScore,
      reasoning: `Settlement amount delta $${(amountDelta / 100).toFixed(2)} exceeds maximum fee policy tolerance $${(policy.maxAllowedFeeDeltaCents / 100).toFixed(2)}.`,
      keyEvidence: parsedOutput.keyEvidence,
      actualModelUsed: openRouterOutput.actualModelUsed,
      promptDurationMs: openRouterOutput.promptDurationMs,
    };
  }

  // Safety Check D: Currency Compatibility
  if (invoice.currency !== matchedPair.bankTx.currency) {
    return {
      status: 'UNRESOLVED',
      selectedBankTxId: null,
      confidenceScore: parsedOutput.confidenceScore,
      reasoning: `Currency mismatch (${invoice.currency} vs ${matchedPair.bankTx.currency}).`,
      keyEvidence: parsedOutput.keyEvidence,
      actualModelUsed: openRouterOutput.actualModelUsed,
      promptDurationMs: openRouterOutput.promptDurationMs,
    };
  }

  // Safety Check E: Date Policy Window
  const dateDelta = matchedPair.dateDeltaDays;
  if (dateDelta < policy.dateWindowDays.minDaysBefore || dateDelta > policy.dateWindowDays.maxDaysAfter) {
    return {
      status: 'UNRESOLVED',
      selectedBankTxId: null,
      confidenceScore: parsedOutput.confidenceScore,
      reasoning: `Transaction date delta ${dateDelta} days is outside policy window [${policy.dateWindowDays.minDaysBefore}, ${policy.dateWindowDays.maxDaysAfter}] days.`,
      keyEvidence: parsedOutput.keyEvidence,
      actualModelUsed: openRouterOutput.actualModelUsed,
      promptDurationMs: openRouterOutput.promptDurationMs,
    };
  }

  // All Application Safety Checks Passed -> Promote candidate to MATCHED
  return {
    status: 'MATCHED',
    selectedBankTxId: matchedPair.bankTx.id,
    confidenceScore: parsedOutput.confidenceScore,
    reasoning: parsedOutput.reasoning,
    keyEvidence: parsedOutput.keyEvidence,
    actualModelUsed: openRouterOutput.actualModelUsed,
    promptDurationMs: openRouterOutput.promptDurationMs,
  };
}
