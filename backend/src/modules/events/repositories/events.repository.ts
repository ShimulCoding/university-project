import { Prisma, type EventStatus } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import { eventManageInclude, publicEventStatuses } from "../events.mappers";
import type { EventListFilters } from "../types/events.types";

function buildLookupWhere(lookupKey: string): Prisma.EventWhereInput {
  return {
    OR: [{ id: lookupKey }, { slug: lookupKey }],
  };
}

function buildSearchWhere(search: string | undefined): Prisma.EventWhereInput | undefined {
  const trimmedSearch = search?.trim();

  if (!trimmedSearch) {
    return undefined;
  }

  return {
    OR: [
      {
        title: {
          contains: trimmedSearch,
          mode: "insensitive",
        },
      },
      {
        slug: {
          contains: trimmedSearch,
          mode: "insensitive",
        },
      },
    ],
  };
}

function buildListWhere(filters: EventListFilters, internal: boolean): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = {};
  const searchWhere = buildSearchWhere(filters.search);

  if (filters.status) {
    where.status = filters.status;
  } else if (!internal) {
    where.status = {
      in: [...publicEventStatuses],
    };
  }

  if (!filters.status && !internal) {
    where.status = {
      in: [...publicEventStatuses],
    };
  }

  if (searchWhere) {
    Object.assign(where, searchWhere);
  }

  return where;
}

type CreateEventData = {
  title: string;
  slug: string;
  description?: string | null | undefined;
  status: EventStatus;
  registrationOpensAt?: Date | undefined;
  registrationClosesAt?: Date | undefined;
  startsAt?: Date | undefined;
  endsAt?: Date | undefined;
  capacity?: number | undefined;
  createdById: string;
};

type UpdateEventData = {
  title?: string | undefined;
  slug?: string | undefined;
  description?: string | null | undefined;
  status?: EventStatus | undefined;
  registrationOpensAt?: Date | undefined;
  registrationClosesAt?: Date | undefined;
  startsAt?: Date | undefined;
  endsAt?: Date | undefined;
  capacity?: number | null | undefined;
};

function buildCreateData(data: CreateEventData): Prisma.EventUncheckedCreateInput {
  return {
    title: data.title,
    slug: data.slug,
    status: data.status,
    createdById: data.createdById,
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.registrationOpensAt ? { registrationOpensAt: data.registrationOpensAt } : {}),
    ...(data.registrationClosesAt ? { registrationClosesAt: data.registrationClosesAt } : {}),
    ...(data.startsAt ? { startsAt: data.startsAt } : {}),
    ...(data.endsAt ? { endsAt: data.endsAt } : {}),
    ...(typeof data.capacity === "number" ? { capacity: data.capacity } : {}),
  };
}

function buildUpdateData(data: UpdateEventData): Prisma.EventUncheckedUpdateInput {
  return {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.slug !== undefined ? { slug: data.slug } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.registrationOpensAt !== undefined
      ? { registrationOpensAt: data.registrationOpensAt }
      : {}),
    ...(data.registrationClosesAt !== undefined
      ? { registrationClosesAt: data.registrationClosesAt }
      : {}),
    ...(data.startsAt !== undefined ? { startsAt: data.startsAt } : {}),
    ...(data.endsAt !== undefined ? { endsAt: data.endsAt } : {}),
    ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
  };
}

export const eventsRepository = {
  findById(eventId: string, db: DbClient = prisma) {
    return db.event.findUnique({
      where: { id: eventId },
      include: eventManageInclude,
    });
  },

  findByLookupKey(lookupKey: string, db: DbClient = prisma) {
    return db.event.findFirst({
      where: buildLookupWhere(lookupKey),
      include: eventManageInclude,
    });
  },

  findPublicByLookupKey(lookupKey: string, db: DbClient = prisma) {
    return db.event.findFirst({
      where: {
        AND: [
          buildLookupWhere(lookupKey),
          {
            status: {
              in: [...publicEventStatuses],
            },
          },
        ],
      },
      include: eventManageInclude,
    });
  },

  listPublic(filters: EventListFilters, db: DbClient = prisma) {
    return db.event.findMany({
      where: buildListWhere(filters, false),
      include: eventManageInclude,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    });
  },

  listManage(filters: EventListFilters, db: DbClient = prisma) {
    return db.event.findMany({
      where: buildListWhere(filters, true),
      include: eventManageInclude,
      orderBy: [{ createdAt: "desc" }],
    });
  },

  countRegistrations(eventId: string, db: DbClient = prisma) {
    return db.registration.count({
      where: { eventId },
    });
  },

  createEvent(data: CreateEventData, db: DbClient = prisma) {
    return db.event.create({
      data: buildCreateData(data),
      include: eventManageInclude,
    });
  },

  updateEvent(eventId: string, data: UpdateEventData, db: DbClient = prisma) {
    return db.event.update({
      where: { id: eventId },
      data: buildUpdateData(data),
      include: eventManageInclude,
    });
  },
};
