import { ComplaintState, RoleCode } from "@prisma/client";
import { z } from "zod";

const complaintRoutingTargetRoles = [
  RoleCode.SYSTEM_ADMIN,
  RoleCode.COMPLAINT_REVIEW_AUTHORITY,
  RoleCode.ORGANIZATIONAL_APPROVER,
] as const;

const optionalNoteField = z.string().trim().max(1000).optional();

export const complaintIdParamSchema = z.object({
  params: z.object({
    complaintId: z.string().cuid(),
  }),
});

export const createComplaintSchema = z.object({
  body: z.object({
    eventId: z.string().cuid().optional(),
    subject: z.string().trim().min(3).max(200),
    description: z.string().trim().min(10).max(5000),
  }),
});

export const listComplaintQueueSchema = z.object({
  query: z.object({
    eventId: z.string().cuid().optional(),
    state: z.nativeEnum(ComplaintState).optional(),
    search: z.string().trim().min(1).max(200).optional(),
  }),
});

export const reviewComplaintSchema = z.object({
  params: z.object({
    complaintId: z.string().cuid(),
  }),
  body: z.object({
    note: optionalNoteField,
  }),
});

export const routeComplaintSchema = z.object({
  params: z.object({
    complaintId: z.string().cuid(),
  }),
  body: z.object({
    toRoleCode: z.enum(complaintRoutingTargetRoles),
    note: optionalNoteField,
  }),
});

export const escalateComplaintSchema = z.object({
  params: z.object({
    complaintId: z.string().cuid(),
  }),
  body: z.object({
    toRoleCode: z.enum(complaintRoutingTargetRoles),
    note: z.string().trim().min(3).max(1000),
  }),
});

export const resolveComplaintSchema = z.object({
  params: z.object({
    complaintId: z.string().cuid(),
  }),
  body: z.object({
    note: optionalNoteField,
  }),
});

export const closeComplaintSchema = z.object({
  params: z.object({
    complaintId: z.string().cuid(),
  }),
  body: z.object({
    note: optionalNoteField,
  }),
});
