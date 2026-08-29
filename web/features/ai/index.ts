/**
 * AI Ambiguity Resolver Domain
 * Downstream OpenRouter LLM ambiguity resolution with strict application safety gates.
 */
export const AI_FEATURE_VERSION = '1.0.0';

export type {
  AIResolverInput,
  AICandidateEvidence,
  AIResolverOutput,
  AIResolverResult,
} from './types';

export { aiResolverOutputSchema } from './types';

export {
  callOpenRouterAIResolver,
  PRIMARY_OPENROUTER_MODEL,
  FALLBACK_OPENROUTER_MODEL,
} from './openrouter';

export { resolveAmbiguityWithAI } from './resolver';
