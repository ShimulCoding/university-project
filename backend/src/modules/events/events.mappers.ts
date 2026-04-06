import { EventStatus, Prisma } from "@prisma/client";

import type { RegistrationWindowState } from "./types/events.types";

export const publicEventStatuses = [
  EventStatus.PUBLISHED,
  EventStatus.REGISTRATION_CLOSED,
  EventStatus.IN_PROGRESS,
  EventStatus.COMPLETED,
  EventStatus.CLOSED,
] as const;

export const eventManageInclude = Prisma.validator<Prisma.EventInclude>()({
  createdBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  _count: {
    select: {
      registrations: true,
    },
  },
});

export type EventWithManagementContext = Prisma.EventGetPayload<{
  include: typeof eventManageInclude;
}>;

function getRegistrationWindowState(event: EventWithManagementContext): RegistrationWindowState {
  const now = new Date();

  if (event.status === EventStatus.DRAFT || event.status === EventStatus.ARCHIVED) {
    return "UNAVAILABLE";
  }

  if (
    event.status === EventStatus.REGISTRATION_CLOSED ||
    event.status === EventStatus.IN_PROGRESS ||
    event.status === EventStatus.COMPLETED ||
    event.status === EventStatus.CLOSED
  ) {
    return "CLOSED";
  }

  if (event.registrationOpensAt && now < event.registrationOpensAt) {
    return "UPCOMING";
  }

  if (event.registrationClosesAt && now > event.registrationClosesAt) {
    return "CLOSED";
  }

  return "OPEN";
}

function buildSharedEventShape(event: EventWithManagementContext) {
  const seatsRemaining =
    typeof event.capacity === "number"
      ? Math.max(event.capacity - event._count.registrations, 0)
      : null;

  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    description: event.description ?? null,
    status: event.status,
    capacity: event.capacity ?? null,
    registeredCount: event._count.registrations,
    seatsRemaining,
    registrationWindow: {
      opensAt: event.registrationOpensAt ?? null,
      closesAt: event.registrationClosesAt ?? null,
      state: getRegistrationWindowState(event),
    },
    schedule: {
      startsAt: event.startsAt ?? null,
      endsAt: event.endsAt ?? null,
    },
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

export function mapPublicEvent(event: EventWithManagementContext) {
  return buildSharedEventShape(event);
}

export function mapManageEvent(event: EventWithManagementContext) {
  return {
    ...buildSharedEventShape(event),
    createdBy: event.createdBy
      ? {
          id: event.createdBy.id,
          fullName: event.createdBy.fullName,
          email: event.createdBy.email,
        }
      : null,
  };
}
