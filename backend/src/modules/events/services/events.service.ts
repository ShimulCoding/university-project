import { EventStatus } from "@prisma/client";

import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import { hasEventManagementAccess } from "../../../utils/role-checks";
import { slugify } from "../../../utils/slugify";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { mapManageEvent, mapPublicEvent, publicEventStatuses } from "../events.mappers";
import { eventsRepository } from "../repositories/events.repository";
import type { CreateEventInput, EventListFilters, UpdateEventInput } from "../types/events.types";

const allowedEventTransitions: Record<EventStatus, EventStatus[]> = {
  [EventStatus.DRAFT]: [EventStatus.PUBLISHED, EventStatus.ARCHIVED],
  [EventStatus.PUBLISHED]: [
    EventStatus.REGISTRATION_CLOSED,
    EventStatus.IN_PROGRESS,
    EventStatus.COMPLETED,
    EventStatus.ARCHIVED,
  ],
  [EventStatus.REGISTRATION_CLOSED]: [
    EventStatus.IN_PROGRESS,
    EventStatus.COMPLETED,
    EventStatus.ARCHIVED,
  ],
  [EventStatus.IN_PROGRESS]: [EventStatus.COMPLETED],
  [EventStatus.COMPLETED]: [EventStatus.CLOSED],
  [EventStatus.CLOSED]: [EventStatus.ARCHIVED],
  [EventStatus.ARCHIVED]: [],
};

function sanitizeNullableText(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function assertPublicStatusFilter(status: EventStatus | undefined) {
  if (!status) {
    return;
  }

  if (!publicEventStatuses.some((publicStatus) => publicStatus === status)) {
    throw new AppError(400, "This event status is not available on the public listing.");
  }
}

function assertValidTimeline(input: {
  registrationOpensAt?: Date | undefined;
  registrationClosesAt?: Date | undefined;
  startsAt?: Date | undefined;
  endsAt?: Date | undefined;
}) {
  if (
    input.registrationOpensAt &&
    input.registrationClosesAt &&
    input.registrationOpensAt > input.registrationClosesAt
  ) {
    throw new AppError(400, "Registration opening time must be before registration closing time.");
  }

  if (input.startsAt && input.endsAt && input.startsAt > input.endsAt) {
    throw new AppError(400, "Event start time must be before event end time.");
  }

  if (input.registrationClosesAt && input.startsAt && input.registrationClosesAt > input.startsAt) {
    throw new AppError(400, "Registration closing time must not be after the event start time.");
  }
}

function assertValidStatusTransition(currentStatus: EventStatus, nextStatus: EventStatus) {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!allowedEventTransitions[currentStatus].includes(nextStatus)) {
    throw new AppError(
      409,
      `Event status cannot transition from ${currentStatus} to ${nextStatus}.`,
    );
  }
}

function assertEventManagementPermissions(viewer: AuthenticatedUser) {
  if (!hasEventManagementAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to manage events.");
  }
}

export const eventsService = {
  async listPublicEvents(filters: EventListFilters) {
    assertPublicStatusFilter(filters.status);

    const paginationOptions = getPaginationOptions(filters);
    const [events, totalItems] = await Promise.all([
      eventsRepository.listPublic(filters, paginationOptions),
      eventsRepository.countPublic(filters),
    ]);

    return {
      events: events.map(mapPublicEvent),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getPublicEvent(eventLookupKey: string) {
    const event = await eventsRepository.findPublicByLookupKey(eventLookupKey);

    if (!event) {
      throw new AppError(404, "Public event not found.");
    }

    return mapPublicEvent(event);
  },

  async listManageEvents(viewer: AuthenticatedUser, filters: EventListFilters) {
    assertEventManagementPermissions(viewer);

    const paginationOptions = getPaginationOptions(filters);
    const [events, totalItems] = await Promise.all([
      eventsRepository.listManage(filters, paginationOptions),
      eventsRepository.countManage(filters),
    ]);

    return {
      events: events.map(mapManageEvent),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getManageEvent(viewer: AuthenticatedUser, eventLookupKey: string) {
    assertEventManagementPermissions(viewer);

    const event = await eventsRepository.findByLookupKey(eventLookupKey);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    return mapManageEvent(event);
  },

  async createEvent(actor: AuthenticatedUser, input: CreateEventInput, auditMetadata?: AuditMetadata) {
    assertEventManagementPermissions(actor);

    const nextStatus = input.status ?? EventStatus.DRAFT;
    const slug = slugify(input.slug ?? input.title);

    if (!slug) {
      throw new AppError(400, "Unable to derive a valid event slug.");
    }

    assertValidTimeline(input);

    const event = await eventsRepository.createEvent({
      title: input.title.trim(),
      slug,
      description: sanitizeNullableText(input.description),
      status: nextStatus,
      registrationOpensAt: input.registrationOpensAt,
      registrationClosesAt: input.registrationClosesAt,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      createdById: actor.id,
    });

    await auditService.record({
      actorId: actor.id,
      action: "events.create",
      entityType: "Event",
      entityId: event.id,
      summary: `Created event ${event.title}`,
      context: {
        slug: event.slug,
        status: event.status,
      },
      ...auditMetadata,
    });

    return mapManageEvent(event);
  },

  async updateEvent(
    actor: AuthenticatedUser,
    eventLookupKey: string,
    input: UpdateEventInput,
    auditMetadata?: AuditMetadata,
  ) {
    assertEventManagementPermissions(actor);

    const event = await eventsRepository.findByLookupKey(eventLookupKey);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    const nextStatus = input.status ?? event.status;
    const nextSlug = input.slug ? slugify(input.slug) : undefined;

    if (input.slug && !nextSlug) {
      throw new AppError(400, "Unable to derive a valid event slug.");
    }

    assertValidStatusTransition(event.status, nextStatus);

    assertValidTimeline({
      registrationOpensAt: input.registrationOpensAt ?? event.registrationOpensAt ?? undefined,
      registrationClosesAt: input.registrationClosesAt ?? event.registrationClosesAt ?? undefined,
      startsAt: input.startsAt ?? event.startsAt ?? undefined,
      endsAt: input.endsAt ?? event.endsAt ?? undefined,
    });

    const updatedEvent = await eventsRepository.updateEvent(event.id, {
      title: input.title?.trim(),
      slug: nextSlug,
      description: sanitizeNullableText(input.description),
      status: nextStatus,
      registrationOpensAt: input.registrationOpensAt,
      registrationClosesAt: input.registrationClosesAt,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
    });

    await auditService.record({
      actorId: actor.id,
      action: "events.update",
      entityType: "Event",
      entityId: updatedEvent.id,
      summary: `Updated event ${updatedEvent.title}`,
      context: {
        previousStatus: event.status,
        nextStatus: updatedEvent.status,
        updatedFields: Object.keys(input),
        slug: updatedEvent.slug,
      },
      ...auditMetadata,
    });

    return mapManageEvent(updatedEvent);
  },
};
