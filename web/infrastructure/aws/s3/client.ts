import { S3Client } from '@aws-sdk/client-s3';
import { getAwsBaseClientConfig } from '../config';

let cachedS3Client: S3Client | null = null;

/**
 * Creates or returns the cached singleton AWS S3 client.
 * Uses standard AWS SDK v3 credentials resolution chain.
 */
export function getS3Client(): S3Client {
  if (!cachedS3Client) {
    const baseConfig = getAwsBaseClientConfig();
    cachedS3Client = new S3Client({
      region: baseConfig.region,
    });
  }
  return cachedS3Client;
}
