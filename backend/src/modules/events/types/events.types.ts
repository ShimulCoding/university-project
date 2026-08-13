import type { EventStatus, RoleCode } from "@prisma/client";

import type { PaginationInput } from "../../../utils/pagination";

export type EventListFilters = PaginationInput & {
  eventIds?: string[] | undefined;
  status?: EventStatus | undefined;
  search?: string | undefined;
};

export type CreateEventInput = {
  title: string;
  slug?: string | undefined;
  description?: string | undefined;
  status?: EventStatus | undefined;
  registrationOpensAt?: Date | undefined;
  registrationClosesAt?: Date | undefined;
  startsAt?: Date | undefined;
  endsAt?: Date | undefined;
  capacity?: number | undefined;
  teamMembers?: EventTeamAssignmentInput[] | undefined;
};

export type UpdateEventInput = Partial<Omit<CreateEventInput, "teamMembers">>;

export type RegistrationWindowState = "UPCOMING" | "OPEN" | "CLOSED" | "UNAVAILABLE";

export type EventTeamAssignmentInput = {
  email: string;
  roleCode: RoleCode;
  password?: string | undefined;
  fullName?: string | undefined;
};
