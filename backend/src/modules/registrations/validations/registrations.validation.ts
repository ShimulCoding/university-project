import { z } from "zod";

export const createRegistrationSchema = z.object({
  body: z.object({
    eventId: z.string().cuid(),
    studentId: z.string().trim().min(3).max(40),
    phone: z.string().trim().min(6).max(30).optional(),
  }),
});

export const registrationIdParamSchema = z.object({
  params: z.object({
    registrationId: z.string().cuid(),
  }),
});

export const eventRegistrationsParamSchema = z.object({
  params: z.object({
    eventId: z.string().cuid(),
  }),
});
