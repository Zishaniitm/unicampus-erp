import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

/**
 * Validates all required environment variables at startup.
 * The app will CRASH with a clear error message if any required
 * variable is missing — better to fail at boot than to fail silently in production.
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_TEST_URL: z.string().url().optional(),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(20),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // SMS
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().default('UNICMP'),
  SMS_RATE_LIMIT_PER_MIN: z.coerce.number().default(100),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('UniCampus ERP <noreply@college.edu.in>'),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('unicampus'),
  MINIO_EXPORT_BUCKET: z.string().default('unicampus-exports'),
  EXPORT_DOWNLOAD_EXPIRY_HOURS: z.coerce.number().default(24),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  COLLEGE_NAME: z.string().default('United Institute of Management (FUGS)'),
  COLLEGE_CODE: z.string().default('FUGS'),
  TIMEZONE: z.string().default('Asia/Kolkata'),

  // Feature flags
  ENABLE_SMS: z.coerce.boolean().default(false),
  ENABLE_EMAIL: z.coerce.boolean().default(true),
  ENABLE_ASYNC_EXPORTS: z.coerce.boolean().default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
