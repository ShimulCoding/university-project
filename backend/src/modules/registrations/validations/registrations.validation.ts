import { z } from "zod";

import { paginationQuerySchema } from "../../../utils/pagination-validation";

export const listRegistrationsSchema = z.object({
  query: z.object({
    ...paginationQuerySchema,
  }),
});

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
  query: z.object({
    ...paginationQuerySchema,
  }),
});
