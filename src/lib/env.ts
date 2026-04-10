import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  APP_NAME: z.string().min(1),
  INVITE_TOKEN_SECRET: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().min(1),
  SESSION_COOKIE_MAX_AGE_SECONDS: z.coerce.number().int().positive(),
  ALIYUN_OSS_REGION: z.string().min(1),
  ALIYUN_OSS_BUCKET: z.string().min(1),
  ALIYUN_OSS_ENDPOINT: z.string().min(1),
  ALIYUN_OSS_ACCESS_KEY_ID: z.string().min(1),
  ALIYUN_OSS_ACCESS_KEY_SECRET: z.string().min(1),
  RESUME_ANALYSIS_BASE_URL: z.string().min(1),
  RESUME_ANALYSIS_API_KEY: z.string().min(1),
  SENTRY_DSN: z.string().optional().default(""),
});

export const env = envSchema.safeParse(process.env);
