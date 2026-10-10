import { governanceTransaction } from "../../../utils/governance-transaction";
import { usersRepository } from "../../users/repositories/users.repository";
import { randomBytes } from "crypto";

import { EventStatus, RoleCode } from "@prisma/client";

import { AppError } from "../../../utils/app-error";
import { sanitizeOptionalText } from "../../../utils/text-utils";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import {
  assertSystemAdminOrEventRole,
  hasEventScopedRole,
} from "../../../utils/event-scope";
import type { AuthenticatedUser } from "../../../types/auth";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { eventsRepository } from "../../events/repositories/events.repository";
import {
  mapRegistrationForFinance,
  mapRegistrationForInternal,
  mapRegistrationForOwner,
  mapRegistrationListItem,
} from "../registrations.mappers";
import { registrationsRepository } from "../repositories/registrations.repository";
import type { CreateRegistrationInput, RegistrationListFilters } from "../types/registrations.types";

const registrationInternalReadRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.FINANCIAL_CONTROLLER,
  RoleCode.EVENT_MANAGEMENT_USER,
] as RoleCode[];

const registrationFinanceRoles = [RoleCode.FINANCIAL_CONTROLLER] as RoleCode[];

function buildRegistrationCode() {
  return `REG-${randomBytes(12).toString("hex").toUpperCase()}`;
}


function assertRegistrationWindowOpen(event: NonNullable<Awaited<ReturnType<typeof eventsRepository.findById>>>) {
  const now = new Date();

  if (event.status !== EventStatus.PUBLISHED) {
    throw new AppError(409, "This event is not currently accepting registrations.");
  }

  if (event.registrationOpensAt && now < event.registrationOpensAt) {
    throw new AppError(409, "Registration has not opened for this event yet.");
  }

  if (event.registrationClosesAt && now >= event.registrationClosesAt) {
    throw new AppError(409, "Registration has already closed for this event.");
  }
}

export const registrationsService = {
  async createRegistration(
    actor: AuthenticatedUser,
    input: CreateRegistrationInput,
    auditMetadata?: AuditMetadata,
  ) {
    return governanceTransaction(async (tx) => {
      const event = await eventsRepository.findById(input.eventId, tx);
      if (!event) {
        throw new AppError(404, "Event not found.");
      }
      assertRegistrationWindowOpen(event);
      const existingParticipantRegistration = await registrationsRepository.findByParticipantAndEvent(actor.id, input.eventId, tx);
      if (existingParticipantRegistration) {
        throw new AppError(409, "You are already registered for this event.");
      }
      const participant = await usersRepository.findById(actor.id, tx);
      if (!participant?.studentId || participant.studentId !== input.studentId.trim()) {
        throw new AppError(400, "Use the Student ID registered to your account. Contact System Admin if your profile needs correction.");
      }
      const existingStudentRegistration = await registrationsRepository.findByStudentId(input.eventId, input.studentId.trim(), tx);
      if (existingStudentRegistration) {
        throw new AppError(409, "This student ID is already registered for the event.");
      }
      if (typeof event.capacity === "number" &&
        event._count.registrations >= event.capacity) {
        throw new AppError(409, "Registration capacity has already been reached.");
      }
      const registration = await registrationsRepository.createRegistration({
        eventId: input.eventId,
        studentId: input.studentId.trim(),
        phone: sanitizeOptionalText(input.phone),
        registrationCode: buildRegistrationCode(),
        participantId: actor.id,
        participantName: actor.fullName,
        email: actor.email,
      }, tx);
      await auditService.record({
        actorId: actor.id,
        action: "registrations.create",
        entityType: "Registration",
        entityId: registration.id,
        summary: `Registered ${actor.email} for ${registration.event.title}`,
        context: {
          eventId: registration.event.id,
          registrationCode: registration.registrationCode,
        },
        ...auditMetadata,
      }, tx);
      return mapRegistrationForOwner(registration);
    }, actor);
  },

  async listMyRegistrations(participantId: string, filters: RegistrationListFilters) {
    const paginationOptions = getPaginationOptions(filters);
    const [registrations, totalItems] = await Promise.all([
      registrationsRepository.listByParticipant(participantId, paginationOptions, undefined, filters.eventId),
      registrationsRepository.countByParticipant(participantId, undefined, filters.eventId),
    ]);

    return {
      registrations: registrations.map(mapRegistrationForOwner),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getRegistrationById(viewer: AuthenticatedUser, registrationId: string) {
    const registration = await registrationsRepository.findById(registrationId);

    if (!registration) {
      throw new AppError(404, "Registration not found.");
    }

    const isOwner = registration.participantId === viewer.id;

    if (!isOwner) {
      assertSystemAdminOrEventRole(
        viewer,
        registration.event.id,
        registrationInternalReadRoles,
        "You are not allowed to view this registration.",
      );
    }

    if (hasEventScopedRole(viewer, registration.event.id, registrationFinanceRoles)) {
      return mapRegistrationForFinance(registration);
    }

    if (isOwner) {
      return mapRegistrationForOwner(registration);
    }

    return mapRegistrationForInternal(registration);
  },

  async listEventRegistrations(
    viewer: AuthenticatedUser,
    eventId: string,
    filters: RegistrationListFilters,
  ) {
    const event = await eventsRepository.findById(eventId);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    assertSystemAdminOrEventRole(
      viewer,
      event.id,
      registrationInternalReadRoles,
      "You are not allowed to view event registrations.",
    );

    const paginationOptions = getPaginationOptions(filters);
    const [registrations, totalItems] = await Promise.all([
      registrationsRepository.listByEvent(eventId, paginationOptions),
      registrationsRepository.countByEvent(eventId),
    ]);
    const financeView = hasEventScopedRole(viewer, event.id, registrationFinanceRoles);

    return {
      registrations: registrations.map((registration) =>
        mapRegistrationListItem(registration, financeView),
      ),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },
};
