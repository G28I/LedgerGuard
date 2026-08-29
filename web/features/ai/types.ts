import { z } from 'zod';
import type { ResultStatus } from '@prisma/client';

/**
 * Clean AI Resolver Output Schema (Zod Validated)
 * Excludes ruleStrength - application policy determines matching method & rule strength.
 */
export const aiResolverOutputSchema = z.object({
  decision: z.enum(['MATCH', 'REJECT', 'UNRESOLVED']),
  selectedBankTxId: z.string().nullable(),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string().min(5).max(1000),
  keyEvidence: z.array(z.string()),
});

export type AIResolverOutput = z.infer<typeof aiResolverOutputSchema>;

/**
 * Candidate Evidence Payload sent to OpenRouter
 */
export interface AICandidateEvidence {
  bankTxId: string;
  transactionRef: string;
  description: string;
  amountCents: number;
  currency: string;
  transactionDate: string; // ISO string
  vendorSimilarity: number;
  dateDeltaDays: number;
  amountDeltaCents: number;
}

/**
 * AI Resolver Input Contract (bounded, 0 ground truth)
 */
export interface AIResolverInput {
  invoice: {
    id: string;
    invoiceNumber: string;
    vendorName: string;
    amountCents: number;
    currency: string;
    issueDate: string;
  };
  candidates: AICandidateEvidence[];
  reconciliationContext: {
    reasonCode: string;
    explanation: string;
  };
}

/**
 * Evaluated AI Resolution Result (after application safety gating)
 */
export interface AIResolverResult {
  status: ResultStatus; // MATCHED | UNRESOLVED
  selectedBankTxId: string | null;
  confidenceScore: number | null;
  reasoning: string;
  keyEvidence: string[];
  actualModelUsed: string;
  promptDurationMs: number;
  exceptionType?: 'AI_UNAVAILABLE' | 'AI_INVALID_RESPONSE' | null;
  exceptionReason?: string;
}
