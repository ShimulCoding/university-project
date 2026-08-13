import { AccountStatus, EventStatus, Prisma, RoleCode } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import {
  assertAnyEventScopedAccess,
  assertEventScopedOperationalAccess,
  assertSystemAdminOrEventRole,
  isSystemAdmin,
  scopeEventFilters,
} from "../../../utils/event-scope";
import { hashPassword } from "../../../utils/password";
import { normalizeEmail } from "../../../utils/normalize-email";
import { slugify } from "../../../utils/slugify";
import { sanitizeNullableText } from "../../../utils/text-utils";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { usersRepository } from "../../users/repositories/users.repository";
import { mapManageEvent, mapPublicEvent, publicEventStatuses } from "../events.mappers";
import { reconciliationRepository } from "../../reconciliation/repositories/reconciliation.repository";
import { eventsRepository } from "../repositories/events.repository";
import type {
  CreateEventInput,
  EventListFilters,
  EventTeamAssignmentInput,
  UpdateEventInput,
} from "../types/events.types";

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
  RoleCode.COMPLAINT_REVIEW_AUTHORITY,
] as RoleCode[];

const eventManageRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.EVENT_MANAGEMENT_USER,
] as RoleCode[];

const requiredEventTeamRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.EVENT_MANAGEMENT_USER,
  RoleCode.FINANCIAL_CONTROLLER,
  RoleCode.ORGANIZATIONAL_APPROVER,
] as RoleCode[];

function assertSystemAdmin(actor: AuthenticatedUser) {
  if (!actor.roles.includes(RoleCode.SYSTEM_ADMIN)) {
    throw new AppError(403, "Only the System Admin can create events and assign event-specific teams.");
  }
}

function deriveFullNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "Event Team Member";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim() || "Event Team Member";
}

function assertRequiredTeamAssignments(assignments: EventTeamAssignmentInput[] | undefined) {
  const assignedRoles = new Set((assignments ?? []).map((assignment) => assignment.roleCode));
  const missingRoles = requiredEventTeamRoles.filter((role) => !assignedRoles.has(role));

  if (missingRoles.length > 0) {
    throw new AppError(
      400,
      `Event creation requires assigned personnel for: ${missingRoles.join(", ")}.`,
    );
  }
}

function assertRequiredRoleSeparation(assignments: EventTeamAssignmentInput[]) {
  const requiredAssignments = assignments.filter((assignment) =>
    requiredEventTeamRoles.includes(assignment.roleCode),
  );
  const seenEmails = new Set<string>();

  for (const assignment of requiredAssignments) {
    const email = normalizeEmail(assignment.email);

    if (seenEmails.has(email)) {
      throw new AppError(
        400,
        "Required event roles must be assigned to separate Google email accounts to preserve separation of duties.",
      );
    }

    seenEmails.add(email);
  }
}

async function resolveAssignableUser(
  actor: AuthenticatedUser,
  input: EventTeamAssignmentInput,
  db: DbClient = prisma,
) {
  const email = normalizeEmail(input.email);
  const existingUser = await usersRepository.findByEmail(email, db);

  if (existingUser) {
    if (existingUser.status !== AccountStatus.ACTIVE) {
      throw new AppError(409, "This user account is not active and cannot be assigned to an event.");
    }

    if (
      existingUser.roles.some(
        (assignment) => assignment.role.code === RoleCode.SYSTEM_ADMIN,
      )
    ) {
      throw new AppError(
        409,
        "The System Administrator cannot also hold an event operational role.",
      );
    }

    return existingUser;
  }

  if (!input.password) {
    throw new AppError(400, "A password is required when assigning a new event team account.");
  }

  return usersRepository.createUser(
    {
      fullName: (input.fullName?.trim() || deriveFullNameFromEmail(email)).slice(0, 100),
      email,
      passwordHash: await hashPassword(input.password),
      status: AccountStatus.ACTIVE,
    },
    db,
  );
}

async function assignTeamMemberForEvent(
  actor: AuthenticatedUser,
  eventId: string,
  input: EventTeamAssignmentInput,
  db: DbClient = prisma,
) {
  const user = await resolveAssignableUser(actor, input, db);

  return eventsRepository.assignTeamMember(
    {
      eventId,
      userId: user.id,
      roleCode: input.roleCode,
      assignedById: actor.id,
    },
    db,
  );
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
  assertAnyEventScopedAccess(viewer, eventReadRoles, "You are not allowed to view managed events.");
}

function assertEventManagementPermissions(
  viewer: AuthenticatedUser,
  eventId: string,
  currentStatus: EventStatus,
  nextStatus: EventStatus,
) {
  if (isSystemAdmin(viewer)) {
    if (
      currentStatus === EventStatus.DRAFT &&
      ([EventStatus.DRAFT, EventStatus.PUBLISHED, EventStatus.ARCHIVED] as EventStatus[]).includes(
        nextStatus,
      )
    ) {
      return;
    }

    throw new AppError(
      403,
      "System Admin can configure and publish a draft event; later operational lifecycle changes belong to its assigned Event Admin or Event Manager.",
    );
  }

  assertEventScopedOperationalAccess(
    viewer,
    eventId,
    eventManageRoles,
    "Only the Event Admin or Event Manager assigned to this event can manage it.",
  );
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

    assertSystemAdminOrEventRole(viewer, event.id, eventReadRoles);

    return mapManageEvent(event);
  },

  async createEvent(actor: AuthenticatedUser, input: CreateEventInput, auditMetadata?: AuditMetadata) {
    assertSystemAdmin(actor);
    assertRequiredTeamAssignments(input.teamMembers);
    assertRequiredRoleSeparation(input.teamMembers ?? []);

    const nextStatus = input.status ?? EventStatus.DRAFT;
    const baseSlug = slugify(input.slug ?? input.title);

    if (!baseSlug) {
      throw new AppError(400, "Unable to derive a valid event slug.");
    }

    assertValidTimeline(input);

    let slug = await deriveUniqueEventSlug(baseSlug);
    let eventInput = {
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
    };

    const event = await prisma.$transaction(async (tx) => {
      let createdEvent;

      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          createdEvent = await eventsRepository.createEvent(eventInput, tx);
          break;
        } catch (error) {
          if (isSlugCollisionError(error)) {
            slug = await deriveUniqueEventSlug(baseSlug);
            eventInput = { ...eventInput, slug };
            continue;
          }
          throw error;
        }
      }

      if (!createdEvent) {
        throw new AppError(500, "Failed to derive a unique event slug after multiple attempts.");
      }

      for (const assignment of input.teamMembers ?? []) {
        await assignTeamMemberForEvent(actor, createdEvent.id, assignment, tx);
      }

      const freshEvent = await eventsRepository.findById(createdEvent.id, tx);

      if (!freshEvent) {
        throw new AppError(500, "Failed to reload event after team assignment.");
      }

      return freshEvent;
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
        assignedTeamRoles: event.teamMembers.map((member) => ({
          roleCode: member.roleCode,
          userId: member.user.id,
        })),
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
    const event = await eventsRepository.findByLookupKey(eventLookupKey);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    const nextStatus = input.status ?? event.status;
    assertEventManagementPermissions(actor, event.id, event.status, nextStatus);
    const nextSlugBase = input.slug ? slugify(input.slug) : undefined;
    const nextDescription = sanitizeNullableText(input.description);

    if (input.slug && !nextSlugBase) {
      throw new AppError(400, "Unable to derive a valid event slug.");
    }

    assertValidStatusTransition(event.status, nextStatus);

    const hasMeaningfulChange =
      (input.title !== undefined && input.title.trim() !== event.title) ||
      (nextSlugBase !== undefined && nextSlugBase !== event.slug) ||
      (input.description !== undefined && nextDescription !== event.description) ||
      (input.status !== undefined && input.status !== event.status) ||
      (input.registrationOpensAt !== undefined &&
        input.registrationOpensAt.getTime() !== event.registrationOpensAt?.getTime()) ||
      (input.registrationClosesAt !== undefined &&
        input.registrationClosesAt.getTime() !== event.registrationClosesAt?.getTime()) ||
      (input.startsAt !== undefined &&
        input.startsAt.getTime() !== event.startsAt?.getTime()) ||
      (input.endsAt !== undefined && input.endsAt.getTime() !== event.endsAt?.getTime()) ||
      (input.capacity !== undefined && input.capacity !== event.capacity);

    if (!hasMeaningfulChange) {
      throw new AppError(400, "No event changes were supplied.");
    }

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
          description: nextDescription,
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
    input: EventTeamAssignmentInput,
    auditMetadata?: AuditMetadata,
  ) {
    assertSystemAdmin(actor);

    const event = await eventsRepository.findByLookupKey(eventLookupKey);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    const normalizedEmail = normalizeEmail(input.email);

    if (
      requiredEventTeamRoles.includes(input.roleCode) &&
      event.teamMembers.some(
        (member) =>
          member.user.email === normalizedEmail &&
          member.roleCode !== input.roleCode &&
          requiredEventTeamRoles.includes(member.roleCode),
      )
    ) {
      throw new AppError(
        400,
        "Required event roles must stay assigned to separate Google email accounts.",
      );
    }

    const member = await assignTeamMemberForEvent(actor, event.id, input);

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
        userId: member.user.id,
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

    if (requiredEventTeamRoles.includes(existingMember.roleCode)) {
      const remainingRequiredRoleMembers = event.teamMembers.filter(
        (member) => member.id !== teamMemberId && member.roleCode === existingMember.roleCode,
      );

      if (remainingRequiredRoleMembers.length === 0) {
        throw new AppError(
          409,
          `Assign another ${existingMember.roleCode} before revoking the current required event team member.`,
        );
      }
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
