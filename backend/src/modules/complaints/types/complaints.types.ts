import type { ComplaintState, RoleCode } from "@prisma/client";

export type ComplaintQueueFilters = {
  eventId?: string | undefined;
  state?: ComplaintState | undefined;
  search?: string | undefined;
};

export type CreateComplaintInput = {
  eventId?: string | undefined;
  subject: string;
  description: string;
};

export type ReviewComplaintInput = {
  note?: string | undefined;
};

export type RouteComplaintInput = {
  toRoleCode: ComplaintRoutingRoleCode;
  note?: string | undefined;
};

export type EscalateComplaintInput = {
  toRoleCode: ComplaintRoutingRoleCode;
  note: string;
};

export type ResolveComplaintInput = {
  note?: string | undefined;
};

export type CloseComplaintInput = {
  note?: string | undefined;
};

export type ComplaintRoutingRoleCode = Extract<
  RoleCode,
  "SYSTEM_ADMIN" | "COMPLAINT_REVIEW_AUTHORITY" | "ORGANIZATIONAL_APPROVER"
>;
