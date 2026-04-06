import { EventStatus } from "@prisma/client";
import { z } from "zod";

const eventLookupKeySchema = z.string().trim().min(1).max(160);

const optionalDateField = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);

const optionalCapacityField = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().max(100000).optional(),
);

const createStatusSchema = z
  .nativeEnum(EventStatus)
  .refine(
    (value) => value === EventStatus.DRAFT || value === EventStatus.PUBLISHED,
    "Event creation only supports DRAFT or PUBLISHED status.",
  );

const eventBodySchema = z.object({
  title: z.string().trim().min(3).max(150),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().trim().max(5000).optional(),
  registrationOpensAt: optionalDateField,
  registrationClosesAt: optionalDateField,
  startsAt: optionalDateField,
  endsAt: optionalDateField,
  capacity: optionalCapacityField,
});

export const listPublicEventsSchema = z.object({
  query: z.object({
    status: z.nativeEnum(EventStatus).optional(),
    search: z.string().trim().max(120).optional(),
  }),
});

export const listManageEventsSchema = listPublicEventsSchema;

export const eventLookupParamSchema = z.object({
  params: z.object({
    eventLookupKey: eventLookupKeySchema,
  }),
});

export const createEventSchema = z.object({
  body: eventBodySchema.extend({
    status: createStatusSchema.optional(),
  }),
});

export const updateEventSchema = z.object({
  params: z.object({
    eventLookupKey: eventLookupKeySchema,
  }),
  body: eventBodySchema
    .extend({
      status: z.nativeEnum(EventStatus).optional(),
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one event field is required.",
    }),
});
