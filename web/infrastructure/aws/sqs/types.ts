import { z } from 'zod';
import type { ReconciliationPolicyConfig } from '@/features/reconciliation';

/**
 * Zod Schema for SQS Reconciliation Job Message validation.
 * Enforces strict runtime validation on all consumed SQS payloads.
 */
export const reconciliationJobPayloadSchema = z.object({
  jobId: z.string().uuid(),
  runId: z.string().min(1),
  runNumber: z.string().min(1),
  seed: z.number().int(),
  batchName: z.string().min(1),
  enableAI: z.boolean(),
  isBenchmark: z.boolean().optional(),
  policyConfig: z.custom<Partial<ReconciliationPolicyConfig>>().optional(),
  enqueuedAt: z.string().datetime(),
});

export type ReconciliationJobPayload = z.infer<typeof reconciliationJobPayloadSchema>;

/**
 * Result contract returned when publishing a job to SQS.
 */
export interface SqsPublishResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly sequenceNumber?: string;
  readonly error?: string;
}

/**
 * Interface for SQS Job Producer.
 */
export interface ISqsJobProducer {
  publishReconciliationJob(payload: Omit<ReconciliationJobPayload, 'jobId' | 'enqueuedAt'>): Promise<SqsPublishResult>;
}

/**
 * SQS Message Processing Result for Consumer loop.
 */
export interface SqsConsumerProcessResult {
  readonly messageId: string;
  readonly runId?: string;
  readonly status: 'PROCESSED' | 'SKIPPED_IDEMPOTENT' | 'FAILED_VALIDATION' | 'FAILED_EXECUTION';
  readonly error?: string;
}

/**
 * Consumer polling options.
 */
export interface SqsConsumerOptions {
  readonly queueUrl?: string;
  readonly maxNumberOfMessages?: number;
  readonly waitTimeSeconds?: number;
  readonly visibilityTimeoutSeconds?: number;
}
