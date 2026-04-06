import type { EventStatus } from "@prisma/client";

export type EventListFilters = {
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
};

export type UpdateEventInput = Partial<CreateEventInput>;

export type RegistrationWindowState = "UPCOMING" | "OPEN" | "CLOSED" | "UNAVAILABLE";
