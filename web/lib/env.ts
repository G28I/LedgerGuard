import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection URL' }),
  OPENROUTER_API_KEY: z.string().min(1, { message: 'OPENROUTER_API_KEY is required for AI reasoning' }),
  OPENROUTER_MODEL: z.string().default('nvidia/llama-3.1-nemotron-70b-instruct:free'),
  MOCK_OPENROUTER: z.string().default('false'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // AWS Infrastructure Configuration (Optional in local development)
  AWS_REGION: z.string().min(1).default('us-east-1'),
  AWS_SQS_RECONCILIATION_QUEUE_URL: z.string().url().optional(),
  AWS_S3_REPORT_BUCKET: z.string().min(1).optional(),
  AWS_SECRETS_MANAGER_SECRET_ID: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    MOCK_OPENROUTER: process.env.MOCK_OPENROUTER,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    AWS_REGION: process.env.AWS_REGION,
    AWS_SQS_RECONCILIATION_QUEUE_URL: process.env.AWS_SQS_RECONCILIATION_QUEUE_URL,
    AWS_S3_REPORT_BUCKET: process.env.AWS_S3_REPORT_BUCKET,
    AWS_SECRETS_MANAGER_SECRET_ID: process.env.AWS_SECRETS_MANAGER_SECRET_ID,
  });

  if (!result.success) {
    console.error('❌ Environment validation failed:', result.error.format());
    throw new Error('Environment validation failed. Please check your .env file.');
  }

  return result.data;
}

export const env = validateEnv();
