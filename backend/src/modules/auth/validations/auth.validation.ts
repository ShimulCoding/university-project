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
    studentId: z.string().trim().min(1, "Student ID is required.").max(30),
    batch: z.string().trim().min(1, "Batch is required.").max(20),
    department: z.string().trim().min(1, "Department is required.").max(50),
    section: z.string().trim().min(1, "Section is required.").max(10),
    ...credentialsSchema.shape,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    studentId: z.string().trim().min(1, "Student ID is required."),
    password: z.string().min(8).max(72),
  }),
});

export const internalLoginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    studentId: z.string().trim().min(1, "Student ID is required."),
    email: z.string().trim().email("Please enter a valid email."),
    newPassword: z.string().min(8, "New password must be at least 8 characters.").max(72),
  }),
});

export const updateEmailSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Please enter a valid email address."),
  }),
});
