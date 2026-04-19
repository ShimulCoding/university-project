import { randomBytes } from "crypto";

import { EventStatus, Prisma } from "@prisma/client";

import { AppError } from "../../../utils/app-error";
import { sanitizeOptionalText } from "../../../utils/text-utils";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import { hasFinanceAccess, hasInternalRegistrationAccess } from "../../../utils/role-checks";
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

function buildRegistrationCode() {
  return `REG-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function waitForRegistrationCodeRetry(attempt: number) {
  const delayMs = 25 * (attempt + 1);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function assertRegistrationWindowOpen(event: NonNullable<Awaited<ReturnType<typeof eventsRepository.findById>>>) {
  const now = new Date();

  if (event.status !== EventStatus.PUBLISHED) {
    throw new AppError(409, "This event is not currently accepting registrations.");
  }

  if (event.registrationOpensAt && now < event.registrationOpensAt) {
    throw new AppError(409, "Registration has not opened for this event yet.");
  }

  if (event.registrationClosesAt && now > event.registrationClosesAt) {
    throw new AppError(409, "Registration has already closed for this event.");
  }
}

async function createRegistrationWithUniqueCode(data: CreateRegistrationInput & {
  participantId: string;
  participantName: string;
  email: string;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await registrationsRepository.createRegistration({
        eventId: data.eventId,
        participantId: data.participantId,
        participantName: data.participantName,
        studentId: data.studentId.trim(),
        email: data.email,
        phone: sanitizeOptionalText(data.phone),
        registrationCode: buildRegistrationCode(),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = error.meta?.target as string[] | string | undefined;
        const isRegistrationCodeCollision = Array.isArray(target)
          ? target.includes("registrationCode")
          : typeof target === "string" && target.includes("registrationCode");

        if (isRegistrationCodeCollision) {
          await waitForRegistrationCodeRetry(attempt);
          continue;
        }

        throw new AppError(
          409,
          "A registration with this student ID already exists for this event.",
        );
      }

      throw error;
    }
  }

  throw new AppError(500, "Failed to allocate a unique registration code.");
}

export const registrationsService = {
  async createRegistration(
    actor: AuthenticatedUser,
    input: CreateRegistrationInput,
    auditMetadata?: AuditMetadata,
  ) {
    const event = await eventsRepository.findById(input.eventId);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    assertRegistrationWindowOpen(event);

    const existingParticipantRegistration = await registrationsRepository.findByParticipantAndEvent(
      actor.id,
      input.eventId,
    );

    if (existingParticipantRegistration) {
      throw new AppError(409, "You are already registered for this event.");
    }

    const existingStudentRegistration = await registrationsRepository.findByStudentId(
      input.eventId,
      input.studentId.trim(),
    );

    if (existingStudentRegistration) {
      throw new AppError(409, "This student ID is already registered for the event.");
    }

    if (
      typeof event.capacity === "number" &&
      event._count.registrations >= event.capacity
    ) {
      throw new AppError(409, "Registration capacity has already been reached.");
    }

    const registration = await createRegistrationWithUniqueCode({
      ...input,
      participantId: actor.id,
      participantName: actor.fullName,
      email: actor.email,
    });

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
    });

    return mapRegistrationForOwner(registration);
  },

  async listMyRegistrations(participantId: string, filters: RegistrationListFilters) {
    const paginationOptions = getPaginationOptions(filters);
    const [registrations, totalItems] = await Promise.all([
      registrationsRepository.listByParticipant(participantId, paginationOptions),
      registrationsRepository.countByParticipant(participantId),
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
    const canViewInternally = hasInternalRegistrationAccess(viewer.roles);

    if (!isOwner && !canViewInternally) {
      throw new AppError(403, "You are not allowed to view this registration.");
    }

    if (hasFinanceAccess(viewer.roles)) {
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
    if (!hasInternalRegistrationAccess(viewer.roles)) {
      throw new AppError(403, "You are not allowed to view event registrations.");
    }

    const event = await eventsRepository.findById(eventId);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    const paginationOptions = getPaginationOptions(filters);
    const [registrations, totalItems] = await Promise.all([
      registrationsRepository.listByEvent(eventId, paginationOptions),
      registrationsRepository.countByEvent(eventId),
    ]);
    const financeView = hasFinanceAccess(viewer.roles);

    return {
      registrations: registrations.map((registration) =>
        mapRegistrationListItem(registration, financeView),
      ),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },
};
