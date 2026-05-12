import { EventStatus, Prisma, RoleCode } from "@prisma/client";

import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import { assertEventScopedAccess, scopeEventFilters } from "../../../utils/event-scope";
import {
  hasEventManagementAccess,
  hasEventManagementReadAccess,
} from "../../../utils/role-checks";
import { normalizeEmail } from "../../../utils/normalize-email";
import { slugify } from "../../../utils/slugify";
import { sanitizeNullableText } from "../../../utils/text-utils";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { rolesRepository } from "../../roles/repositories/roles.repository";
import { usersRepository } from "../../users/repositories/users.repository";
import { mapManageEvent, mapPublicEvent, publicEventStatuses } from "../events.mappers";
import { reconciliationRepository } from "../../reconciliation/repositories/reconciliation.repository";
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

const eventReadRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.EVENT_MANAGEMENT_USER,
  RoleCode.FINANCIAL_CONTROLLER,
  RoleCode.ORGANIZATIONAL_APPROVER,
] as RoleCode[];

const eventManageRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.EVENT_MANAGEMENT_USER,
] as RoleCode[];

function assertSystemAdmin(actor: AuthenticatedUser) {
  if (!actor.roles.includes(RoleCode.SYSTEM_ADMIN)) {
    throw new AppError(403, "Only the System Admin can assign event-specific teams.");
  }
}

async function ensureUserHasRoleCapability(
  userId: string,
  roleCode: RoleCode,
  assignedById: string,
) {
  await rolesRepository.syncCatalog();
  const role = await rolesRepository.findByCode(roleCode);

  if (!role) {
    throw new AppError(404, `Role ${roleCode} not found.`);
  }

  const existingAssignment = await rolesRepository.findActiveAssignment(userId, role.id);

  if (!existingAssignment) {
    await rolesRepository.createAssignment({
      userId,
      roleId: role.id,
      assignedById,
    });
  }
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

function assertEventManagementReadPermissions(viewer: AuthenticatedUser) {
  if (!hasEventManagementReadAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to view managed events.");
  }
}

function assertEventManagementPermissions(viewer: AuthenticatedUser) {
  if (!hasEventManagementAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to manage events.");
  }
}

function isSlugCollisionError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target as string[] | string | undefined;
  return Array.isArray(target)
    ? target.includes("slug")
    : typeof target === "string" && target.includes("slug");
}

async function deriveUniqueEventSlug(baseSlug: string, existingEventId?: string | undefined) {
  let slug = baseSlug;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const existingEvent = await eventsRepository.findBySlug(slug);

    if (!existingEvent || existingEvent.id === existingEventId) {
      return slug;
    }

    slug = `${baseSlug}-${attempt + 2}`;
  }

  throw new AppError(500, "Failed to derive a unique event slug.");
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
    assertEventManagementReadPermissions(viewer);

    const scopedFilters = scopeEventFilters(viewer, filters, eventReadRoles);
    const paginationOptions = getPaginationOptions(filters);
    const [events, totalItems] = await Promise.all([
      eventsRepository.listManage(scopedFilters, paginationOptions),
      eventsRepository.countManage(scopedFilters),
    ]);

    return {
      events: events.map(mapManageEvent),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getManageEvent(viewer: AuthenticatedUser, eventLookupKey: string) {
    assertEventManagementReadPermissions(viewer);

    const event = await eventsRepository.findByLookupKey(eventLookupKey);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    assertEventScopedAccess(viewer, event.id, eventReadRoles);

    return mapManageEvent(event);
  },

  async createEvent(actor: AuthenticatedUser, input: CreateEventInput, auditMetadata?: AuditMetadata) {
    assertEventManagementPermissions(actor);

    const nextStatus = input.status ?? EventStatus.DRAFT;
    const baseSlug = slugify(input.slug ?? input.title);

    if (!baseSlug) {
      throw new AppError(400, "Unable to derive a valid event slug.");
    }

    assertValidTimeline(input);

    let event;
    let slug = await deriveUniqueEventSlug(baseSlug);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        event = await eventsRepository.createEvent({
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
        break;
      } catch (error) {
        if (isSlugCollisionError(error)) {
          slug = await deriveUniqueEventSlug(baseSlug);
          continue;
        }
        throw error;
      }
    }

    if (!event) {
      throw new AppError(500, "Failed to derive a unique event slug after multiple attempts.");
    }

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

    assertEventScopedAccess(actor, event.id, eventManageRoles);

    const nextStatus = input.status ?? event.status;
    const nextSlugBase = input.slug ? slugify(input.slug) : undefined;

    if (input.slug && !nextSlugBase) {
      throw new AppError(400, "Unable to derive a valid event slug.");
    }

    assertValidStatusTransition(event.status, nextStatus);

    assertValidTimeline({
      registrationOpensAt: input.registrationOpensAt ?? event.registrationOpensAt ?? undefined,
      registrationClosesAt: input.registrationClosesAt ?? event.registrationClosesAt ?? undefined,
      startsAt: input.startsAt ?? event.startsAt ?? undefined,
      endsAt: input.endsAt ?? event.endsAt ?? undefined,
    });

    let updatedEvent;
    let nextSlug = nextSlugBase ? await deriveUniqueEventSlug(nextSlugBase, event.id) : undefined;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        updatedEvent = await eventsRepository.updateEvent(event.id, {
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
        break;
      } catch (error) {
        if (nextSlugBase && isSlugCollisionError(error)) {
          nextSlug = await deriveUniqueEventSlug(nextSlugBase, event.id);
          continue;
        }
        throw error;
      }
    }

    if (!updatedEvent) {
      throw new AppError(500, "Failed to derive a unique event slug after multiple attempts.");
    }

    const staleResult = await reconciliationRepository.markReportsStaleForEvent({
      eventId: updatedEvent.id,
      reason: `Event ${updatedEvent.id} changed after reconciliation generation; regenerate before review, finalization, or publication.`,
      staledAt: new Date(),
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
        staleReconciliationReports: staleResult.count,
      },
      ...auditMetadata,
    });

    return mapManageEvent(updatedEvent);
  },

  async assignEventTeamMember(
    actor: AuthenticatedUser,
    eventLookupKey: string,
    input: { email: string; roleCode: RoleCode },
    auditMetadata?: AuditMetadata,
  ) {
    assertSystemAdmin(actor);

    const event = await eventsRepository.findByLookupKey(eventLookupKey);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    const user = await usersRepository.findByEmail(normalizeEmail(input.email));

    if (!user) {
      throw new AppError(404, "User not found. Create the internal user account before assigning it to an event.");
    }

    await ensureUserHasRoleCapability(user.id, input.roleCode, actor.id);
    const member = await eventsRepository.assignTeamMember({
      eventId: event.id,
      userId: user.id,
      roleCode: input.roleCode,
      assignedById: actor.id,
    });

    const updatedEvent = await eventsRepository.findById(event.id);

    if (!updatedEvent) {
      throw new AppError(500, "Failed to reload event team after assignment.");
    }

    await auditService.record({
      actorId: actor.id,
      action: "events.team.assign",
      entityType: "EventTeamMember",
      entityId: member.id,
      summary: `Assigned ${input.roleCode} for ${event.title} to ${member.user.email}`,
      context: {
        eventId: event.id,
        userId: user.id,
        roleCode: input.roleCode,
      },
      ...auditMetadata,
    });

    return mapManageEvent(updatedEvent);
  },

  async revokeEventTeamMember(
    actor: AuthenticatedUser,
    eventLookupKey: string,
    teamMemberId: string,
    auditMetadata?: AuditMetadata,
  ) {
    assertSystemAdmin(actor);

    const event = await eventsRepository.findByLookupKey(eventLookupKey);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    const existingMember = await eventsRepository.findTeamMemberById(teamMemberId);

    if (!existingMember || existingMember.eventId !== event.id || existingMember.revokedAt) {
      throw new AppError(404, "Active event team member not found.");
    }

    const revokedMember = await eventsRepository.revokeTeamMember(teamMemberId);
    const updatedEvent = await eventsRepository.findById(event.id);

    if (!updatedEvent) {
      throw new AppError(500, "Failed to reload event team after revocation.");
    }

    await auditService.record({
      actorId: actor.id,
      action: "events.team.revoke",
      entityType: "EventTeamMember",
      entityId: revokedMember.id,
      summary: `Revoked ${revokedMember.roleCode} for ${event.title} from ${revokedMember.user.email}`,
      context: {
        eventId: event.id,
        userId: revokedMember.userId,
        roleCode: revokedMember.roleCode,
      },
      ...auditMetadata,
    });

    return mapManageEvent(updatedEvent);
  },
};
