import 'dotenv/config';
import { SqsJobConsumer } from '../infrastructure/aws/sqs/consumer';
import { reconciliationService } from '../features/reconciliation/service';
import { isSqsAsyncConfigured } from '../infrastructure/aws/config';
import { env } from '../lib/env';

/**
 * Standalone AWS SQS Reconciliation Background Worker
 * 
 * Usage:
 *   npx tsx scripts/sqs-worker.ts
 *   or: npm run worker
 * 
 * Environment Requirements:
 *   AWS_SQS_RECONCILIATION_QUEUE_URL
 *   AWS_REGION (optional, defaults to us-east-1)
 *   DATABASE_URL
 *   OPENROUTER_API_KEY
 */
async function main() {
  console.log('🚀 Initializing LedgerGuard AWS SQS Reconciliation Worker...');
  console.log(`- AWS Region: ${env.AWS_REGION}`);
  console.log(`- SQS Queue: ${env.AWS_SQS_RECONCILIATION_QUEUE_URL ?? 'NOT_CONFIGURED'}`);

  if (!isSqsAsyncConfigured()) {
    console.error('❌ Error: AWS_SQS_RECONCILIATION_QUEUE_URL is not configured in your environment.');
    console.error('Please configure AWS_SQS_RECONCILIATION_QUEUE_URL in .env before starting the worker.');
    process.exit(1);
  }

  const consumer = new SqsJobConsumer();

  // Handle graceful process termination
  let isShuttingDown = false;
  const handleShutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n🛑 Graceful shutdown signal received. Stopping SQS consumer...');
    consumer.stop();
    setTimeout(() => {
      console.log('👋 Worker process exiting cleanly.');
      process.exit(0);
    }, 2000);
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  // Start polling loop with reconciliationService job processor
  await consumer.startPollingLoop(async (payload) => {
    try {
      const summary = await reconciliationService.processRunJob(payload);
      if (summary.status === 'FAILED') {
        return {
          status: 'FAILED',
          error: summary.errorMessage ?? 'Reconciliation run reported failure',
        };
      }
      return { status: 'COMPLETED' };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        status: 'FAILED',
        error: errMsg,
      };
    }
  });
}

main().catch((err) => {
  console.error('💥 Fatal worker startup error:', err);
  process.exit(1);
});
