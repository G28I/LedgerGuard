import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { getSqsClient } from './client';
import { reconciliationJobPayloadSchema } from './types';
import type { ISqsJobProducer, ReconciliationJobPayload, SqsPublishResult } from './types';
import { env } from '@/lib/env';

/**
 * AWS SQS Reconciliation Job Producer
 * Encapsulates message construction, Zod validation, and publishing to SQS.
 */
export class SqsJobProducer implements ISqsJobProducer {
  private readonly queueUrl: string;

  constructor(queueUrl?: string) {
    const resolvedUrl = queueUrl || env.AWS_SQS_RECONCILIATION_QUEUE_URL;
    if (!resolvedUrl) {
      throw new Error('[SqsJobProducer] AWS_SQS_RECONCILIATION_QUEUE_URL is not configured.');
    }
    this.queueUrl = resolvedUrl;
  }

  async publishReconciliationJob(
    params: Omit<ReconciliationJobPayload, 'jobId' | 'enqueuedAt'>
  ): Promise<SqsPublishResult> {
    const fullPayload: ReconciliationJobPayload = {
      ...params,
      jobId: crypto.randomUUID(),
      enqueuedAt: new Date().toISOString(),
    };

    // 1. Zod Validation prior to publishing
    const validationResult = reconciliationJobPayloadSchema.safeParse(fullPayload);
    if (!validationResult.success) {
      const errorMsg = `Invalid SQS payload: ${JSON.stringify(validationResult.error.flatten())}`;
      console.error('[SqsJobProducer]', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }

    const client = getSqsClient();

    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(validationResult.data),
        MessageAttributes: {
          JobType: {
            DataType: 'String',
            StringValue: 'RECONCILIATION_RUN',
          },
          RunId: {
            DataType: 'String',
            StringValue: fullPayload.runId,
          },
          RunNumber: {
            DataType: 'String',
            StringValue: fullPayload.runNumber,
          },
        },
      });

      const response = await client.send(command);

      return {
        success: true,
        messageId: response.MessageId,
        sequenceNumber: response.SequenceNumber,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[SqsJobProducer] Failed to publish message for Run ${fullPayload.runId}:`, err);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }
}

let cachedProducer: SqsJobProducer | null = null;

/**
 * Returns singleton SQS job producer.
 */
export function getSqsJobProducer(): SqsJobProducer {
  if (!cachedProducer) {
    cachedProducer = new SqsJobProducer();
  }
  return cachedProducer;
}
