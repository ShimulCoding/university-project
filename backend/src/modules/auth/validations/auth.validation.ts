import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
});

export const bootstrapAdminSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(100),
    ...credentialsSchema.shape,
  }),
});

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(100),
    ...credentialsSchema.shape,
  }),
});

export const loginSchema = z.object({
  body: credentialsSchema,
});

