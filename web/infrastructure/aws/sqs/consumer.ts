import { ReceiveMessageCommand, DeleteMessageCommand, Message } from '@aws-sdk/client-sqs';
import { getSqsClient } from './client';
import { reconciliationJobPayloadSchema } from './types';
import type { ReconciliationJobPayload, SqsConsumerOptions, SqsConsumerProcessResult } from './types';
import { env } from '@/lib/env';

export type JobProcessorFn = (payload: ReconciliationJobPayload) => Promise<{ status: 'COMPLETED' | 'SKIPPED_IDEMPOTENT' | 'FAILED'; error?: string }>;

/**
 * AWS SQS Reconciliation Job Consumer
 * Polls SQS queue, validates messages with Zod, executes job processor,
 * enforces idempotency, and deletes successfully processed messages.
 */
export class SqsJobConsumer {
  private readonly queueUrl: string;
  private isRunning = false;

  constructor(options?: SqsConsumerOptions) {
    const resolvedUrl = options?.queueUrl || env.AWS_SQS_RECONCILIATION_QUEUE_URL;
    if (!resolvedUrl) {
      throw new Error('[SqsJobConsumer] AWS_SQS_RECONCILIATION_QUEUE_URL is not configured.');
    }
    this.queueUrl = resolvedUrl;
  }

  /**
   * Polls SQS once, processes available messages, and returns execution summaries.
   */
  async pollAndProcessBatch(
    processor: JobProcessorFn,
    options?: { maxMessages?: number; waitTimeSeconds?: number; visibilityTimeout?: number }
  ): Promise<SqsConsumerProcessResult[]> {
    const client = getSqsClient();
    const results: SqsConsumerProcessResult[] = [];

    const receiveCommand = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: options?.maxMessages ?? 5,
      WaitTimeSeconds: options?.waitTimeSeconds ?? 10,
      VisibilityTimeout: options?.visibilityTimeout ?? 60,
      AttributeNames: ['All'],
      MessageAttributeNames: ['All'],
    });

    let messages: Message[] = [];
    try {
      const response = await client.send(receiveCommand);
      messages = response.Messages ?? [];
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[SqsJobConsumer] Error receiving messages from SQS:', errMsg);
      return results;
    }

    for (const msg of messages) {
      const msgId = msg.MessageId ?? 'unknown';
      const receiptHandle = msg.ReceiptHandle;

      if (!msg.Body || !receiptHandle) {
        console.warn(`[SqsJobConsumer] Received empty message or missing ReceiptHandle: ${msgId}`);
        continue;
      }

      let parsedPayload: ReconciliationJobPayload;
      try {
        const rawJson = JSON.parse(msg.Body);
        const validation = reconciliationJobPayloadSchema.safeParse(rawJson);
        if (!validation.success) {
          console.error(`[SqsJobConsumer] Malformed payload in message ${msgId}:`, validation.error.format());
          results.push({
            messageId: msgId,
            status: 'FAILED_VALIDATION',
            error: JSON.stringify(validation.error.flatten()),
          });
          // Delete poison message to avoid infinite crash loops
          await this.deleteMessage(receiptHandle);
          continue;
        }
        parsedPayload = validation.data;
      } catch (parseErr: unknown) {
        const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        console.error(`[SqsJobConsumer] JSON parse failure for message ${msgId}:`, parseMsg);
        results.push({
          messageId: msgId,
          status: 'FAILED_VALIDATION',
          error: parseMsg,
        });
        // Delete malformed non-JSON poison message
        await this.deleteMessage(receiptHandle);
        continue;
      }

      // Execute Job Processor with Idempotency Protection
      try {
        console.log(`[SqsJobConsumer] Processing Run ${parsedPayload.runId} (${parsedPayload.runNumber})...`);
        const procResult = await processor(parsedPayload);

        if (procResult.status === 'COMPLETED' || procResult.status === 'SKIPPED_IDEMPOTENT') {
          // Acknowledge & delete message from SQS
          await this.deleteMessage(receiptHandle);
          results.push({
            messageId: msgId,
            runId: parsedPayload.runId,
            status: procResult.status === 'COMPLETED' ? 'PROCESSED' : 'SKIPPED_IDEMPOTENT',
          });
          console.log(`[SqsJobConsumer] Successfully finalized Run ${parsedPayload.runId} (${procResult.status}).`);
        } else {
          results.push({
            messageId: msgId,
            runId: parsedPayload.runId,
            status: 'FAILED_EXECUTION',
            error: procResult.error,
          });
          console.error(`[SqsJobConsumer] Processor reported failure for Run ${parsedPayload.runId}:`, procResult.error);
        }
      } catch (execErr: unknown) {
        const execMsg = execErr instanceof Error ? execErr.message : String(execErr);
        console.error(`[SqsJobConsumer] Unhandled exception processing Run ${parsedPayload.runId}:`, execMsg);
        results.push({
          messageId: msgId,
          runId: parsedPayload.runId,
          status: 'FAILED_EXECUTION',
          error: execMsg,
        });
        // Do not delete message; SQS visibility timeout will expire and allow retry or DLQ routing
      }
    }

    return results;
  }

  /**
   * Starts a continuous polling worker loop.
   */
  async startPollingLoop(processor: JobProcessorFn, pollIntervalMs = 1000): Promise<void> {
    this.isRunning = true;
    console.log(`[SqsJobConsumer] Worker started. Polling queue: ${this.queueUrl}`);

    while (this.isRunning) {
      try {
        await this.pollAndProcessBatch(processor);
      } catch (loopErr) {
        console.error('[SqsJobConsumer] Error in polling cycle:', loopErr);
      }
      if (this.isRunning) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }

    console.log('[SqsJobConsumer] Worker stopped cleanly.');
  }

  /**
   * Stops the polling worker loop.
   */
  stop(): void {
    this.isRunning = false;
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const client = getSqsClient();
      await client.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: receiptHandle,
        })
      );
    } catch (delErr) {
      console.error('[SqsJobConsumer] Failed to delete message from SQS:', delErr);
    }
  }
}
