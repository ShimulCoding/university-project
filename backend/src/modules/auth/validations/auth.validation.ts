import { passwordField } from "../../../utils/password-validation";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(255),
  password: passwordField,
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
    studentId: z.string().trim().min(1, "Student ID is required.").max(30),
    password: passwordField,
  }),
});

export const internalLoginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(255),
    password: passwordField,
  }),
});

export const eventTeamLoginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(255),
    password: passwordField,
    eventLookupKey: z.string().trim().min(1).max(160),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    studentId: z.string().trim().min(1, "Student ID is required.").max(30),
    email: z.string().trim().email("Please enter a valid email.").max(255),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required.").max(128),
    newPassword: passwordField,
  }),
});

export const updateEmailSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Please enter a valid email address."),
  }),
});
