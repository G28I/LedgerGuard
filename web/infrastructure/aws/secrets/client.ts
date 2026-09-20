import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { getAwsBaseClientConfig } from '../config';

let cachedSecretsClient: SecretsManagerClient | null = null;

/**
 * Creates or returns the cached singleton AWS Secrets Manager client.
 * Uses standard AWS SDK v3 credentials resolution chain.
 */
export function getSecretsManagerClient(): SecretsManagerClient {
  if (!cachedSecretsClient) {
    const baseConfig = getAwsBaseClientConfig();
    cachedSecretsClient = new SecretsManagerClient({
      region: baseConfig.region,
    });
  }
  return cachedSecretsClient;
}
