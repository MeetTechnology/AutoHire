import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().min(1).default("AutoHire"),
  APP_RUNTIME_MODE: z.enum(["auto", "memory", "prisma"]).default("auto"),
  INVITE_TOKEN_SECRET: z.string().min(1).default("autohire-dev-secret"),
  SESSION_COOKIE_NAME: z.string().min(1).default("autohire_session"),
  SESSION_COOKIE_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(604800),
  FILE_STORAGE_MODE: z.enum(["mock", "oss"]).default("mock"),
  ALIYUN_OSS_REGION: z.string().optional(),
  ALIYUN_OSS_BUCKET: z.string().optional(),
  ALIYUN_OSS_ENDPOINT: z.string().optional(),
  ALIYUN_OSS_TRANSFER_ACCELERATION_ENABLED: z.coerce.boolean().default(false),
  ALIYUN_OSS_ACCELERATE_ENDPOINT: z
    .string()
    .url()
    .default("https://oss-accelerate.aliyuncs.com"),
  ALIYUN_OSS_ACCESS_KEY_ID: z.string().optional(),
  ALIYUN_OSS_ACCESS_KEY_SECRET: z.string().optional(),
  RESUME_ANALYSIS_MODE: z.enum(["mock", "live"]).default("mock"),
  RESUME_ANALYSIS_BASE_URL: z.string().optional(),
  RESUME_ANALYSIS_API_KEY: z.string().optional(),
  RESUME_ANALYSIS_REANALYZE_PATH: z.string().optional(),
  RESUME_ANALYSIS_MAPPINGS_PATH: z.string().optional(),
  RESUME_ANALYSIS_CALLBACK_SECRET: z.string().optional(),
  RESUME_ANALYSIS_CALLBACK_URL: z.string().url().optional(),
  RESUME_ANALYSIS_AUTO_SECONDARY_ON_UPLOAD: z.string().optional(),
  MATERIAL_REVIEW_MODE: z.enum(["mock", "live"]).default("mock"),
  MATERIAL_REVIEW_MOCK_SCENARIO: z.string().default("supplement_required"),
  MATERIAL_REVIEW_BASE_URL: z.string().optional(),
  MATERIAL_REVIEW_API_KEY: z.string().optional(),
  MATERIAL_REVIEW_INTEGRATION_IDENTITY_PATH: z
    .string()
    .default("/reviews/applications/{applicationId}/integration-identity"),
  MATERIAL_REVIEW_MAPPING_PATH: z
    .string()
    .default("/reviews/applications/{applicationId}/mapping"),
  MATERIAL_REVIEW_CALLBACK_SECRET: z.string().optional(),
  ASK_AI_MODE: z.enum(["mock", "live"]).default("mock"),
  ASK_AI_ALIYUN_BASE_URL: z
    .string()
    .url()
    .default("https://dashscope.aliyuncs.com"),
  ASK_AI_ALIYUN_API_KEY: z.string().optional(),
  ASK_AI_ALIYUN_APP_ID: z.string().optional(),
  ASK_AI_DEFAULT_LOCALE: z.string().min(1).default("zh-CN"),
  ASK_AI_TRACE_RAW_RESPONSE: z.coerce.boolean().default(false),
  ASK_AI_MAX_QUESTION_CHARS: z.coerce.number().int().positive().default(1000),
  ASK_AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  ASK_AI_SOURCE_PREVIEW_ALLOWED_HOSTS: z
    .string()
    .default("dashscope-file-datacenter-prod-01.oss-cn-beijing.aliyuncs.com"),
  AUDIT_DASHBOARD_TOKENS: z.string().optional().default(""),
  AUDIT_DASHBOARD_COOKIE_NAME: z
    .string()
    .min(1)
    .default("autohire_audit_session"),
  AUDIT_DASHBOARD_COOKIE_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(28800),
  SENTRY_DSN: z.string().optional().default(""),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional().default(""),
});

let cachedEnv: z.infer<typeof envSchema> | undefined;

export function getEnv() {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}

export function resetEnvForTests() {
  if (process.env.NODE_ENV !== "test") {
    return;
  }

  cachedEnv = undefined;
}

export function getRuntimeMode() {
  const env = getEnv();

  if (env.APP_RUNTIME_MODE === "memory" || env.APP_RUNTIME_MODE === "prisma") {
    return env.APP_RUNTIME_MODE;
  }

  return env.DATABASE_URL ? "prisma" : "memory";
}
