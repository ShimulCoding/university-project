import { type RegistrationPaymentState } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import type { PaginationOptions } from "../../../utils/pagination";
import { registrationDetailInclude } from "../registrations.mappers";

type CreateRegistrationData = {
  eventId: string;
  participantId: string;
  participantName: string;
  studentId: string;
  email: string;
  phone?: string | undefined;
  registrationCode: string;
};

export const registrationsRepository = {
  findById(registrationId: string, db: DbClient = prisma) {
    return db.registration.findUnique({
      where: { id: registrationId },
      include: registrationDetailInclude,
    });
  },

  findByParticipantAndEvent(participantId: string, eventId: string, db: DbClient = prisma) {
    return db.registration.findFirst({
      where: {
        participantId,
        eventId,
      },
      include: registrationDetailInclude,
    });
  },

  findByStudentId(eventId: string, studentId: string, db: DbClient = prisma) {
    return db.registration.findUnique({
      where: {
        eventId_studentId: {
          eventId,
          studentId,
        },
      },
      include: registrationDetailInclude,
    });
  },

  listByParticipant(
    participantId: string,
    pagination?: PaginationOptions,
    db: DbClient = prisma,
  ) {
    return db.registration.findMany({
      where: { participantId },
      include: registrationDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    });
  },

  countByParticipant(participantId: string, db: DbClient = prisma) {
    return db.registration.count({
      where: { participantId },
    });
  },

  listByEvent(eventId: string, pagination?: PaginationOptions, db: DbClient = prisma) {
    return db.registration.findMany({
      where: { eventId },
      include: registrationDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    });
  },

  countByEvent(eventId: string, db: DbClient = prisma) {
    return db.registration.count({
      where: { eventId },
    });
  },

  createRegistration(data: CreateRegistrationData, db: DbClient = prisma) {
    return db.registration.create({
      data: {
        eventId: data.eventId,
        participantId: data.participantId,
        participantName: data.participantName,
        studentId: data.studentId,
        email: data.email,
        ...(data.phone ? { phone: data.phone } : {}),
        registrationCode: data.registrationCode,
      },
      include: registrationDetailInclude,
    });
  },

  updatePaymentState(
    registrationId: string,
    paymentState: RegistrationPaymentState,
    db: DbClient = prisma,
  ) {
    return db.registration.update({
      where: { id: registrationId },
      data: {
        paymentState,
      },
      include: registrationDetailInclude,
    });
  },
};
