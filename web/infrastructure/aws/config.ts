import { env } from '@/lib/env';

/**
 * Common AWS Client Configuration
 * Uses standard AWS credential provider chain (Environment -> SSO -> IAM Instance/ECS Role -> WebIdentity).
 * Strictly forbids hardcoded credentials, static secrets, or account IDs.
 */
export interface AwsClientBaseConfig {
  readonly region: string;
}

/**
 * Returns baseline AWS SDK v3 client configuration.
 * When running in AWS ECS/Lambda, credentials are automatically resolved by the SDK runtime.
 */
export function getAwsBaseClientConfig(): AwsClientBaseConfig {
  return {
    region: env.AWS_REGION || 'us-east-1',
  };
}

/**
 * Verification helper to determine whether AWS SQS async queuing is configured.
 */
export function isSqsAsyncConfigured(): boolean {
  return typeof env.AWS_SQS_RECONCILIATION_QUEUE_URL === 'string' && env.AWS_SQS_RECONCILIATION_QUEUE_URL.length > 0;
}

/**
 * Verification helper to determine whether AWS S3 audit report storage is configured.
 */
export function isS3StorageConfigured(): boolean {
  return typeof env.AWS_S3_REPORT_BUCKET === 'string' && env.AWS_S3_REPORT_BUCKET.length > 0;
}

/**
 * Verification helper to determine whether AWS Secrets Manager is configured.
 */
export function isSecretsManagerConfigured(): boolean {
  return typeof env.AWS_SECRETS_MANAGER_SECRET_ID === 'string' && env.AWS_SECRETS_MANAGER_SECRET_ID.length > 0;
}
