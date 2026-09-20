import { SQSClient } from '@aws-sdk/client-sqs';
import { getAwsBaseClientConfig } from '../config';

let cachedSqsClient: SQSClient | null = null;

/**
 * Creates or returns the cached singleton AWS SQS client.
 * Uses standard AWS SDK v3 credentials resolution chain.
 */
export function getSqsClient(): SQSClient {
  if (!cachedSqsClient) {
    const baseConfig = getAwsBaseClientConfig();
    cachedSqsClient = new SQSClient({
      region: baseConfig.region,
    });
  }
  return cachedSqsClient;
}
