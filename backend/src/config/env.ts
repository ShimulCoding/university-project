import { z } from "zod";

import { loadProjectEnv } from "./load-env";
import { durationToMs } from "../utils/duration";

loadProjectEnv();

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().default("http://localhost:3000").refine(
    (value) => value.split(",").every((origin) => {
      try { return ["http:", "https:"].includes(new URL(origin.trim()).protocol); }
      catch { return false; }
    }),
    "FRONTEND_URL must contain HTTP(S) URLs separated by commas.",
  ),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  MFA_ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9+/]{43}=$/, "MFA_ENCRYPTION_KEY must be a separate 32-byte base64 key."),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  ACCESS_TOKEN_COOKIE_NAME: z.string().default("mu_access_token"),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default("mu_refresh_token"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  UPLOADS_ROOT: z.string().min(1).default("uploads"),
});

const parsedEnv = rawEnvSchema.parse(process.env);
durationToMs(parsedEnv.ACCESS_TOKEN_TTL);
durationToMs(parsedEnv.REFRESH_TOKEN_TTL);

export const env = {
  ...parsedEnv,
  corsOrigins: parsedEnv.FRONTEND_URL.split(",")
    .map((origin) => new URL(origin.trim()).origin)
    .filter(Boolean),
} as const;
