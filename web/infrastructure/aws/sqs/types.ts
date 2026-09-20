import type { ReconciliationPolicyConfig } from '@/features/reconciliation';

/**
 * Message payload published to AWS SQS for asynchronous reconciliation execution.
 */
export interface ReconciliationJobPayload {
  readonly runId: string;
  readonly runNumber: string;
  readonly seed: number;
  readonly batchName: string;
  readonly enableAI: boolean;
  readonly isBenchmark?: boolean;
  readonly policyConfig?: Partial<ReconciliationPolicyConfig>;
  readonly enqueuedAt: string;
}

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
  publishReconciliationJob(payload: ReconciliationJobPayload): Promise<SqsPublishResult>;
}
