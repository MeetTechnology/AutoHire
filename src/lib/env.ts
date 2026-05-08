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
  ALIYUN_OSS_ACCESS_KEY_ID: z.string().optional(),
  ALIYUN_OSS_ACCESS_KEY_SECRET: z.string().optional(),
  RESUME_ANALYSIS_MODE: z.enum(["mock", "live"]).default("mock"),
  RESUME_ANALYSIS_BASE_URL: z.string().optional(),
  RESUME_ANALYSIS_API_KEY: z.string().optional(),
  RESUME_ANALYSIS_REANALYZE_PATH: z.string().optional(),
  RESUME_ANALYSIS_MAPPINGS_PATH: z.string().optional(),
  MATERIAL_REVIEW_MODE: z.enum(["mock", "live"]).default("mock"),
  MATERIAL_REVIEW_BASE_URL: z.string().optional(),
  MATERIAL_REVIEW_API_KEY: z.string().optional(),
  MATERIAL_REVIEW_CALLBACK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional().default(""),
});

let cachedEnv: z.infer<typeof envSchema> | undefined;

export function getEnv() {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}

export function getRuntimeMode() {
  const env = getEnv();

  if (env.APP_RUNTIME_MODE === "memory" || env.APP_RUNTIME_MODE === "prisma") {
    return env.APP_RUNTIME_MODE;
  }

  return env.DATABASE_URL ? "prisma" : "memory";
}
