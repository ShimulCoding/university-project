import { z } from "zod";

import { loadProjectEnv } from "./load-env";

loadProjectEnv();

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  ACCESS_TOKEN_COOKIE_NAME: z.string().default("mu_access_token"),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default("mu_refresh_token"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  UPLOADS_ROOT: z.string().min(1).default("uploads"),
});

const parsedEnv = rawEnvSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  corsOrigins: parsedEnv.FRONTEND_URL.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;
