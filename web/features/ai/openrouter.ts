import { env } from '@/lib/env';
import type { AIResolverInput } from './types';

export const PRIMARY_OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';
export const FALLBACK_OPENROUTER_MODEL = 'qwen/qwen-2.5-72b-instruct';

export interface OpenRouterCallResult {
  rawJsonText: string;
  actualModelUsed: string;
  promptDurationMs: number;
}

/**
 * OpenRouter API Adapter
 * Sends structured prompt to OpenRouter with model failovers and 8s timeout.
 */
export async function callOpenRouterAIResolver(
  input: AIResolverInput,
  preferredModel: string = PRIMARY_OPENROUTER_MODEL
): Promise<OpenRouterCallResult> {
  // Support mock mode for deterministic offline testing when OpenRouter API credits are unavailable
  if (process.env.MOCK_OPENROUTER === 'true') {
    const topCandidate = input.candidates[0];
    const isGoodMatch = topCandidate && topCandidate.vendorSimilarity >= 0.70 && topCandidate.amountDeltaCents === 0;

    const mockOutput = isGoodMatch
      ? {
          decision: 'MATCH',
          selectedBankTxId: topCandidate.bankTxId,
          confidenceScore: 0.92,
          reasoning: `AI Model (${preferredModel}): Identified valid settlement match for ${input.invoice.vendorName} based on high vendor similarity (${(topCandidate.vendorSimilarity * 100).toFixed(0)}%) and exact amount agreement.`,
          keyEvidence: [
            `Vendor similarity ${(topCandidate.vendorSimilarity * 100).toFixed(0)}%`,
            `Exact amount settlement $${(topCandidate.amountCents / 100).toFixed(2)}`,
            `Valid date proximity (${topCandidate.dateDeltaDays} days)`,
          ],
        }
      : {
          decision: 'UNRESOLVED',
          selectedBankTxId: null,
          confidenceScore: 0.45,
          reasoning: `AI Model (${preferredModel}): Evidence insufficient or multiple plausible candidates tie. Safety policy requires human auditor review.`,
          keyEvidence: ['Ambiguous or conflicting candidate evidence'],
        };

    return {
      rawJsonText: JSON.stringify(mockOutput),
      actualModelUsed: `${preferredModel} (Mock)`,
      promptDurationMs: 15,
    };
  }

  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not configured');
  }

  const promptMessage = `You are an expert financial auditor assisting an automated reconciliation engine.
Evaluate an unresolved Invoice against up to 3 candidate bank transactions and decide if any candidate is a safe, legitimate settlement match.

Input Invoice:
- Invoice Ref: "${input.invoice.invoiceNumber}"
- Vendor Name: "${input.invoice.vendorName}"
- Amount: $${(input.invoice.amountCents / 100).toFixed(2)} (${input.invoice.currency})
- Issue Date: ${input.invoice.issueDate}

Deterministic Status: UNRESOLVED (${input.reconciliationContext.reasonCode})
Reason: ${input.reconciliationContext.explanation}

Candidate Settlement Transactions:
${JSON.stringify(input.candidates, null, 2)}

Instructions:
1. Carefully compare vendor names, memo tokens, amounts, and dates.
2. If one candidate clearly corresponds to the invoice payment despite minor vendor name variations or minor memo differences, select its "bankTxId", choose decision "MATCH", and assign a confidenceScore (0.00 to 1.00).
3. If no candidate is safe or candidates are genuinely ambiguous/conflicting, choose decision "UNRESOLVED" or "REJECT" with selectedBankTxId = null.
4. Output STRICT JSON matching this schema:
{
  "decision": "MATCH" | "REJECT" | "UNRESOLVED",
  "selectedBankTxId": "string or null",
  "confidenceScore": number (0.0 to 1.0),
  "reasoning": "brief explanation",
  "keyEvidence": ["list of evidence bullet points"]
}`;

  const startTime = Date.now();
  let actualModel = preferredModel;

  const tryCall = async (model: string, retryAttempts: number = 1): Promise<string> => {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retryAttempts) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://ledgerguard.local',
            'X-Title': 'LedgerGuard Financial Reconciliation',
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'You are a precise financial audit system. Respond ONLY in valid raw JSON.',
              },
              {
                role: 'user',
                content: promptMessage,
              },
            ],
            temperature: 0.1, // Low temperature for consistent deterministic reasoning
          }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const isTransient = response.status === 429 || response.status >= 500;

          if (isTransient && attempt <= retryAttempts) {
            console.warn(`[OpenRouter] HTTP ${response.status} rate limit/server error on ${model}. Retrying attempt ${attempt}...`);
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
          throw new Error(`OpenRouter API HTTP ${response.status}: ${errorText.slice(0, 200)}`);
        }

        const data = await response.json();
        actualModel = data.model ?? model;
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('OpenRouter response contained empty message content');
        }
        return content;
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        lastError = err;

        // If AbortError (timeout) or transient error and retries remain
        if (attempt <= retryAttempts && (err instanceof Error && err.name === 'AbortError')) {
          console.warn(`[OpenRouter] Timeout on ${model}. Retrying attempt ${attempt}...`);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        break;
      }
    }

    throw lastError;
  };

  try {
    const content = await tryCall(preferredModel);
    return {
      rawJsonText: content,
      actualModelUsed: actualModel,
      promptDurationMs: Date.now() - startTime,
    };
  } catch (primaryErr) {
    console.warn(`Primary OpenRouter model ${preferredModel} failed: ${String(primaryErr)}. Trying fallback model ${FALLBACK_OPENROUTER_MODEL}...`);
    const content = await tryCall(FALLBACK_OPENROUTER_MODEL);
    return {
      rawJsonText: content,
      actualModelUsed: actualModel,
      promptDurationMs: Date.now() - startTime,
    };
  }
}
