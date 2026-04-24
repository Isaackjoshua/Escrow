import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  AFRICAS_TALKING_API_KEY: z.string().min(1),
  AFRICAS_TALKING_USERNAME: z.string().min(1),
  AFRICAS_TALKING_SENDER_ID: z.string().default('ESCROW255'),
  SELCOM_API_KEY: z.string().min(1),
  SELCOM_API_SECRET: z.string().min(1),
  SELCOM_VENDOR_ID: z.string().min(1),
  SELCOM_BASE_URL: z.string().url(),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(10),
  INSPECTION_WINDOW_HOURS: z.coerce.number().default(48),
  PLATFORM_FEE_PERCENT: z.coerce.number().default(2.5),
  DISPUTE_FAST_TRACK_FEE_TZS: z.coerce.number().default(5000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
